import {
  MessageType,
  type FlowRunAtomicStepType,
  type FlowRunDataSourceInput,
  type FlowRunExecuteResultPayload,
  type FlowRunExecuteStepPayload,
  type FlowRunFlowSnapshot,
  type FlowRunLogEntry,
  type FlowRunStartPayload,
  type FlowRunStepRequestId,
  type FlowRunState,
  type FlowRunStatusPayload,
  type FlowRunVaultUnlockPromptPayload,
  type FlowRunVaultUnlockPromptResult,
  type RuntimeMessage,
} from '../../../shared/messages';
import type { FlowStepData } from '../../../shared/flowStepMigration';
import { deriveSiteKeyFromUrl, normalizeSiteKey } from '../../../shared/urlKeys';
import {
  isRecoverableTabMessageError,
  type BrowserTabChangeInfo,
} from '../runtime/pageContext';
import { TabBridge } from '../runtime/tabBridge';
import { parseDataSourceRows } from './dataSource';
import { JsTransformExecutor } from './jsTransformExecutor';
// 1.1 — background code calls the SW-only vault module directly (same
// realm, no message round-trip). Sidepanel / content code uses
// `shared/secretsClient.ts` instead.
import { resolveSecretTokens, unlockSecretsVault } from '../secretsVault';
import { removeRunSentinel, writeRunSentinel, type RunSentinel } from './runSentinel';
import {
  getRenderedStepFieldValue,
  getStepField,
  getStepFieldRawValue,
  microYield,
  toNonNegativeInteger,
  truncateForLog,
  type FlowRenderContext,
  type FlowRowContext,
} from './tokenRenderer';

const STEP_ACTION_TIMEOUT_MS = 10_000;
const WAIT_SELECTOR_TIMEOUT_MS = 6_000;
const NAVIGATION_TIMEOUT_MS = 20_000;
const CONDITION_POLL_INTERVAL_MS = 120;
const STATUS_THROTTLE_MS = 200;
const STEP_MESSAGE_RETRY_TIMEOUT_MS = 60_000;
const STEP_MESSAGE_RETRY_INTERVAL_MS = 250;
const STEP_RESULT_WAIT_GRACE_MS = 1_200;
const STEP_RESULT_WAIT_MIN_MS = 1_000;
const ENABLE_EVENT_DRIVEN_RECOVERY = true;
const MAX_RUN_LOG_ENTRIES = 500;
// Runtime ceilings. Per AGENTS.md §7 this file is the source of truth for
// these caps. They're intentionally conservative — large enough for realistic
// flows, small enough that a misconfigured / malicious flow is bounded.
// If any of these need to be user-configurable, expose them through
// globalSettings and respect both the setting and the hard ceiling here.
const MAX_TOTAL_STEPS_EXECUTED = 10_000;
const MAX_LOOP_ITERATIONS = 5_000;
const MAX_RUN_DURATION_MS = 10 * 60 * 1000;
const VARIABLE_NAME_PATTERN = /^[A-Za-z_][0-9A-Za-z_]*$/;

type FlowRunError = {
  code: string;
  message: string;
  phase?: 'dispatch' | 'execute' | 'result-wait' | 'navigate';
  recoverable?: boolean;
};

type InFlightRecoverSource = 'timeout' | 'tab-updated' | 'page-ping';
type InFlightStepStatus = 'dispatched' | 'awaiting_result' | 'superseded';

type InFlightAtomicStep = {
  stepId: string;
  stepType: FlowRunAtomicStepType;
  payload: FlowRunExecuteStepPayload;
  attempt: number;
  currentRequestId: FlowRunStepRequestId;
  stepStartUrl: string;
  lastKnownUrl: string;
  deadlineAt: number;
  startedAt: number;
  status: InFlightStepStatus;
  recoverSource?: InFlightRecoverSource;
};

type FlowRunInternal = {
  runId: string;
  flow: FlowRunFlowSnapshot;
  source: FlowRunStartPayload['source'];
  dataSourceInputs: Record<string, FlowRunDataSourceInput>;
  tabId: number;
  targetFrameId?: number;
  siteKey: string;
  state: FlowRunState;
  currentStepId?: string;
  progress: {
    completedSteps: number;
    totalSteps: number;
  };
  error?: FlowRunError;
  startedAt: number;
  endedAt?: number;
  activeUrl: string;
  cancelRequested: boolean;
  abortReason?: FlowRunError;
  lastStatusPushAt: number;
  logs: FlowRunLogEntry[];
  logSequence: number;
  variables: Record<string, string>;
  // 1.5 taint tracking. Contains variable names whose current value is
  // secret-derived (from {{secret.*}} resolution, from a JS transform whose
  // input was tainted, or from an executeRead on a sensitive DOM element).
  // `set-variable` mutates this Set — add on tainted assignment, delete on
  // explicit clean assignment. `toStatusPayload` does NOT broadcast
  // `variables`, so leakage only needs to be guarded on log/payload sinks.
  taintedVariables: Set<string>;
  executedStepCount: number;
  statusTimer?: ReturnType<typeof setTimeout>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  inFlightAtomic?: InFlightAtomicStep;
};

// 1.5 — Result of resolving one step field. `tainted=true` means the value
// is secret-derived (via {{secret.*}}, {{var.X}} where X is tainted, OR via
// a JS transform whose input was tainted). Runner-internal ONLY — never
// cross a messaging boundary as this wrapper.
type ResolvedFieldValue = {
  value: string;
  tainted: boolean;
};

// 1.5 — Parallel struct so taintedFields never rides inside the payload
// itself. The payload crosses `runtime.sendMessage` to the content script;
// a taint flag hitching on the payload (even with an underscore prefix)
// is one `delete` away from leaking. Literal union keeps the set tight:
// adding a new taint-carrying payload field is a compile error until you
// opt it in here.
type TaintedPayloadField = 'value' | 'expected' | 'message' | 'selector';
type BuiltAtomicPayload = {
  payload: FlowRunExecuteStepPayload;
  taintedFields: Set<TaintedPayloadField>;
};

const REDACTED_PLACEHOLDER = '[REDACTED]';
const redactIfTainted = (value: string | undefined, tainted: boolean) =>
  tainted ? REDACTED_PLACEHOLDER : value ?? '';

// 1.5 — Broad detection: whole-value match (isSecretTokenValue) is too
// narrow; a field like "prefix-{{secret.X}}-suffix" still leaks after
// resolution. This scans for any secret token anywhere in the raw field.
const SECRET_TOKEN_ANYWHERE = /\{\{\s*secret\.[^{}]+\s*\}\}/;
const VARIABLE_TOKEN_ANYWHERE = /\{\{\s*var\.([A-Za-z_][0-9A-Za-z_]*)\s*\}\}/g;
const isRawFieldTainted = (rawValue: string, taintedVariables: Set<string>) => {
  if (!rawValue) {
    return false;
  }
  if (SECRET_TOKEN_ANYWHERE.test(rawValue)) {
    return true;
  }
  for (const match of rawValue.matchAll(VARIABLE_TOKEN_ANYWHERE)) {
    if (taintedVariables.has(match[1])) {
      return true;
    }
  }
  return false;
};

export class RunnerError extends Error {
  readonly code: string;
  readonly phase?: FlowRunError['phase'];
  readonly recoverable?: boolean;

  constructor(code: string, message: string, options?: { phase?: FlowRunError['phase']; recoverable?: boolean }) {
    super(message);
    this.code = code;
    this.phase = options?.phase;
    this.recoverable = options?.recoverable;
  }
}

const estimateFlowStep = (step: FlowStepData): number => {
  if (
    step.type === 'click' ||
    step.type === 'input' ||
    step.type === 'wait' ||
    step.type === 'assert' ||
    step.type === 'popup' ||
    step.type === 'navigate' ||
    step.type === 'set-variable'
  ) {
    return 1;
  }
  if (step.type === 'loop') {
    const iterations = toNonNegativeInteger(getStepFieldRawValue(step, 'iterations'), 0);
    return iterations * estimateFlowSteps(step.children ?? []);
  }
  if (step.type === 'if-else') {
    const { thenSteps, elseSteps } = selectIfElseBranches(step);
    return 1 + Math.max(estimateFlowSteps(thenSteps), estimateFlowSteps(elseSteps));
  }
  if (step.type === 'data-source') {
    const rowEstimate =
      typeof step.dataSource?.rowCount === 'number' && Number.isFinite(step.dataSource.rowCount)
        ? Math.max(0, step.dataSource.rowCount)
        : 1;
    return rowEstimate * estimateFlowSteps(step.children ?? []);
  }
  return 1;
};

const estimateFlowSteps = (steps: FlowStepData[]) =>
  steps.reduce((total, step) => total + estimateFlowStep(step), 0);

const normalizeDelimitedText = (value: string) => value.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isVaultUnlockPromptResult = (value: unknown): value is FlowRunVaultUnlockPromptResult => {
  if (!isRecordObject(value) || typeof value.action !== 'string') {
    return false;
  }
  if (value.action === 'cancel' || value.action === 'navigation') {
    return true;
  }
  if (value.action === 'submit') {
    return typeof value.password === 'string';
  }
  return false;
};

const collectDataSourceStepIds = (steps: FlowStepData[], sink: string[] = []) => {
  for (const step of steps) {
    if (step.type === 'data-source') {
      sink.push(step.id);
    }
    if (Array.isArray(step.children) && step.children.length > 0) {
      collectDataSourceStepIds(step.children, sink);
    }
    if (Array.isArray(step.branches) && step.branches.length > 0) {
      for (const branch of step.branches) {
        collectDataSourceStepIds(branch.steps ?? [], sink);
      }
    }
  }
  return sink;
};

const selectIfElseBranches = (step: FlowStepData) => {
  const branches = Array.isArray(step.branches) ? step.branches : [];
  const matchBy = (keyword: string) =>
    branches.find((branch) => `${branch.id} ${branch.label}`.toLowerCase().includes(keyword));
  const thenBranch = matchBy('then') || branches[0];
  const elseBranch =
    matchBy('else') || branches.find((branch) => branch !== thenBranch) || branches[1];
  return {
    thenSteps: thenBranch?.steps ?? [],
    elseSteps: elseBranch?.steps ?? [],
  };
};

type FlowRunnerManagerOptions = {
  runtime?: {
    sendMessage?: (message: RuntimeMessage) => void;
  };
  tabBridge: TabBridge;
  statusThrottleMs?: number;
  // 1.13 — unique marker for this SW lifetime. Stamped into every run
  // sentinel so next cold-start's orphan-cleanup can distinguish our own
  // sentinels from those left behind by a previous suspended SW.
  swInstanceId?: string;
  // 1.13 — promise that resolves once bootstrap's orphan-cleanup pass has
  // finished. `start()` awaits this before writing a new sentinel, so a
  // fresh sentinel is never in storage at the instant cleanup enumerates
  // keys. Defaults to an already-resolved promise when absent (tests /
  // standalone construction).
  orphanCleanupPromise?: Promise<void>;
};

type PendingStepRequest = {
  runId: string;
  stepId: string;
  stepType: FlowRunAtomicStepType;
  resolve: (value: FlowRunExecuteResultPayload) => void;
  reject: (reason?: unknown) => void;
  timeoutHandle?: ReturnType<typeof setTimeout>;
};

export class FlowRunnerManager {
  private readonly runs = new Map<string, FlowRunInternal>();

  private readonly activeRunByTab = new Map<number, string>();

  private readonly pendingStepRequests = new Map<FlowRunStepRequestId, PendingStepRequest>();

  private readonly runtime?: FlowRunnerManagerOptions['runtime'];

  private readonly tabBridge: TabBridge;

  private readonly statusThrottleMs: number;

  private readonly jsTransformExecutor = new JsTransformExecutor();

  private stepRequestSequence = 0;

  // 1.13 — see FlowRunnerManagerOptions comments.
  private readonly swInstanceId: string;
  private readonly orphanCleanupPromise: Promise<void>;

  constructor(options: FlowRunnerManagerOptions) {
    this.runtime = options.runtime;
    this.tabBridge = options.tabBridge;
    this.statusThrottleMs = options.statusThrottleMs ?? STATUS_THROTTLE_MS;
    this.swInstanceId =
      options.swInstanceId ?? `sw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.orphanCleanupPromise = options.orphanCleanupPromise ?? Promise.resolve();
  }

  async start(payload: FlowRunStartPayload, options?: { targetFrameId?: number }) {
    const flow = payload.flow;
    if (!flow || !flow.id || !Array.isArray(flow.steps)) {
      throw new RunnerError('invalid-flow-payload', 'Flow payload is invalid.');
    }
    const activeTab = await this.tabBridge.queryActiveTab();
    const tabId = activeTab?.id;
    if (!tabId) {
      throw new RunnerError('no-active-tab', 'No active tab.');
    }
    if (this.activeRunByTab.size > 0) {
      throw new RunnerError('runner-busy', 'Another flow is already running.');
    }
    if (this.activeRunByTab.has(tabId)) {
      throw new RunnerError('runner-busy', 'A flow is already running on this tab.');
    }
    const flowSiteKey = normalizeSiteKey(flow.siteKey || '');
    if (!flowSiteKey) {
      throw new RunnerError('flow-site-missing', 'Flow site key is missing.');
    }
    const activeSiteKey = deriveSiteKeyFromUrl(activeTab?.url || '');
    if (activeSiteKey !== flowSiteKey) {
      throw new RunnerError(
        'site-mismatch',
        `Active site (${activeSiteKey || 'unknown'}) does not match flow site (${flowSiteKey}).`,
      );
    }
    const runDataSourceInputs: Record<string, FlowRunDataSourceInput> = {};
    const rawInputs =
      payload.dataSourceInputs && typeof payload.dataSourceInputs === 'object'
        ? payload.dataSourceInputs
        : {};
    for (const [stepId, sourceInput] of Object.entries(rawInputs)) {
      if (!sourceInput || typeof sourceInput !== 'object') {
        continue;
      }
      const typedInput = sourceInput as Partial<FlowRunDataSourceInput>;
      if (
        typeof typedInput.fileName !== 'string' ||
        (typedInput.fileType !== 'csv' && typedInput.fileType !== 'tsv') ||
        typeof typedInput.rawText !== 'string'
      ) {
        continue;
      }
      runDataSourceInputs[stepId] = {
        fileName: typedInput.fileName,
        fileType: typedInput.fileType,
        rawText: typedInput.rawText,
      };
    }
    const requiredDataSourceStepIds = collectDataSourceStepIds(flow.steps);
    if (requiredDataSourceStepIds.length > 0) {
      for (const stepId of requiredDataSourceStepIds) {
        if (!(stepId in runDataSourceInputs)) {
          throw new RunnerError(
            'data-source-input-required',
            'data-source-input-required',
          );
        }
      }
    }

    // 1.13 — Wait for bootstrap's orphan-cleanup pass to finish before
    // writing this run's sentinel. Cleanup reads all keys synchronously in
    // one pass; once awaited here, any later write is guaranteed not to
    // race against an in-flight cleanup read.
    await this.orphanCleanupPromise;

    const now = Date.now();
    const runId = `run-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const run: FlowRunInternal = {
      runId,
      flow,
      source: payload.source,
      dataSourceInputs: runDataSourceInputs,
      tabId,
      targetFrameId: typeof options?.targetFrameId === 'number' ? options.targetFrameId : undefined,
      siteKey: flowSiteKey,
      state: 'queued',
      progress: {
        completedSteps: 0,
        totalSteps: Math.max(1, estimateFlowSteps(flow.steps)),
      },
      startedAt: now,
      activeUrl: activeTab?.url || '',
      cancelRequested: false,
      lastStatusPushAt: 0,
      logs: [],
      logSequence: 0,
      variables: {},
      taintedVariables: new Set(),
      executedStepCount: 0,
    };
    this.runs.set(runId, run);
    this.activeRunByTab.set(tabId, runId);
    // 1.13 — persist initial sentinel so a suspended-then-revived SW can
    // detect this run as orphaned.
    this.refreshRunSentinel(run);
    this.appendLog(run, 'info', `Run queued for flow "${flow.name || flow.id}".`);
    this.emitStatus(run, true);
    void this.executeRun(run);
    return { runId };
  }

  // 1.13 — Write the current run state to chrome.storage.session. Called
  // at run start, on step transitions (`executeSteps`), after each step
  // completion (`markStepCompleted`), and once more at `finalizeRun` with
  // the terminal state so the orphan-cleanup pass can silently skip
  // already-finalized runs even if the subsequent delete is lost to an
  // SW-suspend race. Fire-and-forget: errors logged, not surfaced.
  private refreshRunSentinel(run: FlowRunInternal) {
    const sentinel: RunSentinel = {
      runId: run.runId,
      flowId: run.flow.id,
      tabId: run.tabId,
      siteKey: run.siteKey,
      startedAt: run.startedAt,
      totalSteps: run.progress.totalSteps,
      completedSteps: run.progress.completedSteps,
      currentStepId: run.currentStepId,
      state: run.state,
      activeUrl: run.activeUrl,
      swInstanceId: this.swInstanceId,
    };
    writeRunSentinel(sentinel);
  }

  stop(runId: string) {
    const run = this.runs.get(runId);
    if (!run) {
      throw new RunnerError('run-not-found', 'Run not found.');
    }
    if (this.isRunFinalized(run)) {
      return { runId };
    }
    // Route through finalizeRun so releaseActiveRun + scheduleCleanup run
    // exactly once. Pre-idempotency, stop() used to do a half-inline finalize
    // and rely on executeRun's catch (awoken by cancelPendingRequests) to call
    // finalizeRun a second time for the cleanup. With finalizeRun now
    // idempotent, that second call is a no-op — so stop() must drive the
    // terminal path itself. cancelRequested stays set so the awoken catch
    // still takes the 'cancelled' branch (its finalizeRun call is guarded).
    run.cancelRequested = true;
    this.appendLog(run, 'info', 'Stop requested.');
    this.finalizeRun(run, 'cancelled');
    return { runId };
  }

  onPageContextPing(tabId: number, url: string) {
    const run = this.getRunByTab(tabId);
    if (!run) {
      return;
    }
    this.updateRunActiveUrl(run, url);
    this.tryRecoverInFlightStep(run, 'page-ping');
  }

  onTabUpdated(tabId: number, changeInfo: BrowserTabChangeInfo, tab: { url?: string }) {
    const run = this.getRunByTab(tabId);
    if (!run) {
      return;
    }
    if (changeInfo.url) {
      this.updateRunActiveUrl(run, changeInfo.url);
    } else if (tab.url) {
      this.updateRunActiveUrl(run, tab.url);
    }
    this.tryRecoverInFlightStep(run, 'tab-updated');
  }

  // Tab closed mid-run. Without this path, the run sits in activeRunByTab
  // forever, inFlightAtomic never resolves, and the next start() fails with
  // "runner-busy" until the 60s step-dispatch timeout eventually fires.
  // finalizeRun already clears inFlight, cancels pending requests, releases
  // activeRunByTab, and schedules cleanup — we just drive it from here.
  // Do NOT set cancelRequested: this is a runtime failure (tab closed),
  // not a user-requested cancel. finalizeRun's idempotency guard + the
  // executeRun catch are what keep the "tab-closed" error code from being
  // overwritten when cancelPendingRequests rejects the awaiting coroutine.
  onTabRemoved(tabId: number) {
    const run = this.getRunByTab(tabId);
    if (!run || this.isRunFinalized(run)) {
      return;
    }
    this.finalizeRun(run, 'failed', {
      code: 'tab-closed',
      message: 'The tab running this flow was closed.',
      phase: 'execute',
      recoverable: false,
    });
  }

  onStepResult(payload: FlowRunExecuteResultPayload) {
    if (!payload?.requestId) {
      return;
    }
    const run = this.runs.get(payload.runId);
    if (!run || this.isRunFinalized(run)) {
      return;
    }
    const pending = this.pendingStepRequests.get(payload.requestId);
    if (!pending) {
      this.appendLog(run, 'info', `stale-result ignored: ${payload.requestId}`, {
        stepId: payload.stepId,
        stepType: payload.stepType,
      });
      return;
    }
    if (pending.runId !== payload.runId || pending.stepId !== payload.stepId || pending.stepType !== payload.stepType) {
      this.appendLog(run, 'info', `stale-result ignored: ${payload.requestId}`, {
        stepId: payload.stepId,
        stepType: payload.stepType,
      });
      return;
    }
    const inFlight = run.inFlightAtomic;
    if (!inFlight || inFlight.currentRequestId !== payload.requestId) {
      this.pendingStepRequests.delete(payload.requestId);
      if (pending.timeoutHandle) {
        clearTimeout(pending.timeoutHandle);
      }
      this.appendLog(run, 'info', `stale-result ignored: ${payload.requestId}`, {
        stepId: payload.stepId,
        stepType: payload.stepType,
      });
      return;
    }
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    this.pendingStepRequests.delete(payload.requestId);
    pending.resolve(payload);
  }

  private getRunByTab(tabId: number) {
    const runId = this.activeRunByTab.get(tabId);
    if (!runId) {
      return null;
    }
    return this.runs.get(runId) ?? null;
  }

  private nextStepRequestId(run: FlowRunInternal, stepId: string) {
    this.stepRequestSequence += 1;
    return `${run.runId}-${stepId}-${this.stepRequestSequence}`;
  }

  private cancelPendingRequests(runId: string, reason: RunnerError) {
    for (const [requestId, pending] of this.pendingStepRequests.entries()) {
      if (pending.runId !== runId) {
        continue;
      }
      if (pending.timeoutHandle) {
        clearTimeout(pending.timeoutHandle);
      }
      this.pendingStepRequests.delete(requestId);
      pending.reject(reason);
    }
  }

  private isRunFinalized(run: FlowRunInternal) {
    return run.state === 'succeeded' || run.state === 'failed' || run.state === 'cancelled';
  }

  private clearInFlightAtomic(run: FlowRunInternal, stepId?: string) {
    if (!run.inFlightAtomic) {
      return;
    }
    if (stepId && run.inFlightAtomic.stepId !== stepId) {
      return;
    }
    run.inFlightAtomic = undefined;
  }

  private supersedeInFlightRequest(
    run: FlowRunInternal,
    source: InFlightRecoverSource,
    reason: string,
  ) {
    const inFlight = run.inFlightAtomic;
    if (!inFlight || inFlight.status === 'superseded') {
      return false;
    }
    inFlight.status = 'superseded';
    inFlight.recoverSource = source;
    inFlight.lastKnownUrl = run.activeUrl || inFlight.lastKnownUrl;
    const pending = this.pendingStepRequests.get(inFlight.currentRequestId);
    if (!pending) {
      return false;
    }
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    this.pendingStepRequests.delete(inFlight.currentRequestId);
    pending.reject(
      new RunnerError('step-request-superseded', reason, {
        phase: 'result-wait',
        recoverable: true,
      }),
    );
    this.appendLog(run, 'info', `recover: supersede request ${inFlight.currentRequestId}`, {
      stepId: inFlight.stepId,
      stepType: inFlight.stepType,
    });
    return true;
  }

  private settleInFlightClickAsNavigationSuccess(
    run: FlowRunInternal,
    source: InFlightRecoverSource,
  ) {
    const inFlight = run.inFlightAtomic;
    if (!inFlight || inFlight.stepType !== 'click' || inFlight.status === 'superseded') {
      return false;
    }
    const pending = this.pendingStepRequests.get(inFlight.currentRequestId);
    if (!pending) {
      return false;
    }
    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    this.pendingStepRequests.delete(inFlight.currentRequestId);
    inFlight.status = 'superseded';
    inFlight.recoverSource = source;
    const requestId = inFlight.currentRequestId;
    this.appendLog(run, 'info', 'recover: click treated success due navigation', {
      stepId: inFlight.stepId,
      stepType: inFlight.stepType,
    });
    pending.resolve({
      ok: true,
      runId: run.runId,
      requestId,
      stepId: inFlight.stepId,
      stepType: 'click',
      details: {
        selector: inFlight.payload.selector,
        elementText: 'navigation-likely',
      },
    });
    return true;
  }

  private tryRecoverInFlightStep(run: FlowRunInternal, source: InFlightRecoverSource) {
    if (!ENABLE_EVENT_DRIVEN_RECOVERY || this.isRunFinalized(run)) {
      return;
    }
    const inFlight = run.inFlightAtomic;
    if (!inFlight || inFlight.status === 'superseded') {
      return;
    }
    const currentUrl = run.activeUrl || inFlight.lastKnownUrl || inFlight.stepStartUrl;
    if (!currentUrl) {
      return;
    }
    const currentSiteKey = deriveSiteKeyFromUrl(currentUrl);
    if (!currentSiteKey || currentSiteKey !== run.siteKey) {
      return;
    }
    const hasNavigation = Boolean(inFlight.stepStartUrl && currentUrl !== inFlight.stepStartUrl);
    if (inFlight.stepType === 'click') {
      if (hasNavigation) {
        this.settleInFlightClickAsNavigationSuccess(run, source);
      }
      return;
    }
    const isRetryableStep =
      inFlight.stepType === 'input' ||
      inFlight.stepType === 'read' ||
      inFlight.stepType === 'wait' ||
      inFlight.stepType === 'assert' ||
      inFlight.stepType === 'condition' ||
      inFlight.stepType === 'popup';
    if (!isRetryableStep) {
      return;
    }
    if (inFlight.stepType === 'popup' && !hasNavigation && source === 'tab-updated') {
      this.supersedeInFlightRequest(run, source, 'popup-refresh-dismissed');
      return;
    }
    if (inFlight.stepType !== 'wait' && !hasNavigation) {
      return;
    }
    this.supersedeInFlightRequest(run, source, `recover:${source}`);
  }

  private appendLog(
    run: FlowRunInternal,
    level: FlowRunLogEntry['level'],
    message: string,
    options?: { stepId?: string; stepType?: FlowRunLogEntry['stepType']; forceStatus?: boolean },
  ) {
    const entry: FlowRunLogEntry = {
      id: `${run.runId}-${run.logSequence}`,
      timestamp: Date.now(),
      level,
      message,
      stepId: options?.stepId,
      stepType: options?.stepType,
    };
    run.logSequence += 1;
    run.logs.push(entry);
    if (run.logs.length > MAX_RUN_LOG_ENTRIES) {
      run.logs.splice(0, run.logs.length - MAX_RUN_LOG_ENTRIES);
    }
    this.emitStatus(run, options?.forceStatus === true);
  }

  // 1.5 — taintedFields redacts expected/message when they're secret-derived.
  // selector is intentionally NOT redacted even when tainted: it's a DOM
  // query string, users need it in logs to debug, and while a secret-in-
  // selector is unusual it's not the same leak severity as printing a
  // password in plaintext. Revisit if real attack scenarios surface.
  private formatAtomicStartMessage(
    stepType: FlowRunAtomicStepType,
    payload: FlowRunExecuteStepPayload,
    taintedFields: Set<TaintedPayloadField>,
  ) {
    const safeExpected = truncateForLog(redactIfTainted(payload.expected, taintedFields.has('expected')));
    const safeMessage = truncateForLog(redactIfTainted(payload.message, taintedFields.has('message')));
    if (stepType === 'click') {
      return `Click selector "${truncateForLog(payload.selector || '')}".`;
    }
    if (stepType === 'input') {
      return `Input value into "${truncateForLog(payload.selector || '')}".`;
    }
    if (stepType === 'wait') {
      if (payload.mode === 'time') {
        return `Wait ${payload.durationMs ?? 0} ms.`;
      }
      if (payload.mode === 'appear') {
        return `Wait for "${truncateForLog(payload.selector || '')}" to appear.`;
      }
      if (payload.mode === 'disappear') {
        return `Wait for "${truncateForLog(payload.selector || '')}" to disappear.`;
      }
      return `Wait until "${truncateForLog(payload.selector || '')}" ${payload.operator || 'contains'} "${safeExpected}".`;
    }
    if (stepType === 'assert') {
      return `Assert "${truncateForLog(payload.selector || '')}" ${payload.operator || 'contains'} "${safeExpected}".`;
    }
    if (stepType === 'popup') {
      return `Show popup "${safeMessage}".`;
    }
    if (stepType === 'read') {
      return `Read value from "${truncateForLog(payload.selector || '')}".`;
    }
    if (stepType === 'condition') {
      return `Check condition on "${truncateForLog(payload.selector || '')}".`;
    }
    return `Execute ${stepType} step.`;
  }

  // 1.5 — Narrowed result type. `actual` and `sensitive` are deliberately
  // absent from the type signature so any attempt to inline them into a
  // success-log message is a compile error. `details.actual` is also
  // stripped via the Omit override. If a formatter needs richer info,
  // update the pick set here after reviewing the leak surface.
  // taintedFields mirrors the startMessage contract: popup.message is
  // echoed back by content as details.popupMessage, so the 'message' taint
  // flag must redact both.
  private formatAtomicSuccessMessage(
    stepType: FlowRunAtomicStepType,
    payload: FlowRunExecuteStepPayload,
    result: {
      ok: FlowRunExecuteResultPayload['ok'];
      conditionMatched?: FlowRunExecuteResultPayload['conditionMatched'];
      // `expected` is also omitted: the content script echoes payload.expected
      // back into details.expected verbatim, so it inherits the full taint of
      // the original payload but has no separate redaction path. A future
      // formatter that wants to show "expected X, got Y" must go through
      // `payload.expected` + taintedFields check, not this echo. `popupMessage`
      // intentionally stays — it's consumed as a fallback and is redacted
      // manually via `taintedFields.has('message')`; a future cleanup could
      // fold it into this Omit and re-extract purely from payload.message.
      details?: Omit<NonNullable<FlowRunExecuteResultPayload['details']>, 'actual' | 'expected'>;
      error?: FlowRunExecuteResultPayload['error'];
      errorCode?: FlowRunExecuteResultPayload['errorCode'];
    },
    taintedFields: Set<TaintedPayloadField>,
  ) {
    const details = result.details;
    if (stepType === 'click') {
      const clickedName = details?.elementText ? ` "${truncateForLog(details.elementText)}"` : '';
      return `Clicked${clickedName} (${truncateForLog(payload.selector || '')}).`;
    }
    if (stepType === 'input') {
      const fieldName = details?.fieldName ? truncateForLog(details.fieldName) : truncateForLog(payload.selector || '');
      return `Input completed into ${fieldName}.`;
    }
    if (stepType === 'wait') {
      if (payload.mode === 'time') {
        return `Waited ${payload.durationMs ?? 0} ms.`;
      }
      if (payload.mode === 'appear') {
        return `Selector appeared: ${truncateForLog(payload.selector || '')}.`;
      }
      if (payload.mode === 'disappear') {
        return `Selector disappeared: ${truncateForLog(payload.selector || '')}.`;
      }
      return `Wait condition matched on ${truncateForLog(payload.selector || '')}.`;
    }
    if (stepType === 'assert') {
      return `Assertion passed on ${truncateForLog(payload.selector || '')}.`;
    }
    if (stepType === 'popup') {
      const rawMessage = payload.message || details?.popupMessage || '';
      return `Popup shown: "${truncateForLog(redactIfTainted(rawMessage, taintedFields.has('message')))}".`;
    }
    if (stepType === 'read') {
      return `Read completed from ${truncateForLog(payload.selector || '')}.`;
    }
    if (stepType === 'condition') {
      return result.conditionMatched ? 'Condition matched.' : 'Condition not matched.';
    }
    return `${stepType} step completed.`;
  }

  private updateRunActiveUrl(run: FlowRunInternal, url: string) {
    if (!url) {
      return;
    }
    run.activeUrl = url;
    const siteKey = deriveSiteKeyFromUrl(url);
    if (siteKey && siteKey !== run.siteKey && !run.abortReason) {
      run.abortReason = {
        code: 'cross-site-navigation',
        message: `Detected cross-site navigation: ${siteKey}`,
      };
    }
    this.emitStatus(run, false);
  }

  // 1.5 TAINT BOUNDARY — this is the one structure that crosses from runner
  // memory to the sidepanel via runtime.sendMessage. Adding fields here that
  // could carry secret-derived material (notably: `variables`,
  // `taintedVariables`, any resolved field value, any content-script result
  // payload with `actual`) undoes the redaction work done in formatters.
  // If you need to add something, verify:
  //   1) is the value ever secret-derived? (check resolveStepFieldValue paths)
  //   2) if yes, does it get redacted before inclusion here?
  // Current fields are all either structural (ids, state, progress) or
  // already-redacted (logs: messages are formatted via
  // formatAtomicStartMessage / formatAtomicSuccessMessage which honor the
  // taint set).
  private toStatusPayload(run: FlowRunInternal): FlowRunStatusPayload {
    return {
      runId: run.runId,
      flowId: run.flow.id,
      siteKey: run.siteKey,
      tabId: run.tabId,
      state: run.state,
      currentStepId: run.currentStepId,
      progress: { ...run.progress },
      error: run.error
        ? {
            code: run.error.code,
            message: run.error.message,
            phase: run.error.phase,
            recoverable: run.error.recoverable,
          }
        : undefined,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      activeUrl: run.activeUrl,
      logs: [...run.logs],
    };
  }

  private emitStatus(run: FlowRunInternal, force: boolean) {
    const runtime = this.runtime;
    const sendMessage = runtime?.sendMessage;
    if (!sendMessage) {
      return;
    }
    const sendNow = () => {
      run.lastStatusPushAt = Date.now();
      sendMessage({
        type: MessageType.FLOW_RUN_STATUS,
        data: this.toStatusPayload(run),
        forwarded: true,
      } satisfies RuntimeMessage);
    };
    if (force) {
      if (run.statusTimer) {
        clearTimeout(run.statusTimer);
        run.statusTimer = undefined;
      }
      sendNow();
      return;
    }
    const elapsed = Date.now() - run.lastStatusPushAt;
    if (elapsed >= this.statusThrottleMs) {
      sendNow();
      return;
    }
    if (!run.statusTimer) {
      run.statusTimer = setTimeout(() => {
        run.statusTimer = undefined;
        sendNow();
      }, Math.max(0, this.statusThrottleMs - elapsed));
    }
  }

  private clearRunTimers(run: FlowRunInternal) {
    if (run.statusTimer) {
      clearTimeout(run.statusTimer);
      run.statusTimer = undefined;
    }
    if (run.cleanupTimer) {
      clearTimeout(run.cleanupTimer);
      run.cleanupTimer = undefined;
    }
  }

  private releaseActiveRun(run: FlowRunInternal) {
    const activeRunId = this.activeRunByTab.get(run.tabId);
    if (activeRunId === run.runId) {
      this.activeRunByTab.delete(run.tabId);
    }
  }

  private scheduleCleanup(run: FlowRunInternal) {
    if (run.cleanupTimer) {
      clearTimeout(run.cleanupTimer);
    }
    run.cleanupTimer = setTimeout(() => {
      this.clearRunTimers(run);
      this.runs.delete(run.runId);
    }, 60_000);
  }

  private ensureRunHealthy(run: FlowRunInternal) {
    if (run.cancelRequested || run.state === 'cancelled') {
      throw new RunnerError('cancelled', 'Run cancelled.');
    }
    if (run.abortReason) {
      throw new RunnerError(run.abortReason.code, run.abortReason.message);
    }
    if (run.state === 'failed') {
      throw new RunnerError(run.error?.code || 'run-failed', run.error?.message || 'Run failed.');
    }
    if (Date.now() - run.startedAt > MAX_RUN_DURATION_MS) {
      throw new RunnerError(
        'run-duration-exceeded',
        `Run exceeded the ${Math.round(MAX_RUN_DURATION_MS / 1000)}s duration cap.`,
        { phase: 'execute', recoverable: false },
      );
    }
    if (run.executedStepCount > MAX_TOTAL_STEPS_EXECUTED) {
      throw new RunnerError(
        'run-step-count-exceeded',
        `Run exceeded the ${MAX_TOTAL_STEPS_EXECUTED} total-step cap.`,
        { phase: 'execute', recoverable: false },
      );
    }
  }

  private finalizeRun(run: FlowRunInternal, state: FlowRunState, error?: FlowRunError) {
    // Idempotent by design. Multiple code paths can race to finalize a run —
    // e.g. onTabRemoved drives finalizeRun(failed, 'tab-closed') while the
    // executeRun coroutine is awaiting a pending request that our own
    // cancelPendingRequests then rejects, waking its catch. Without this
    // guard the later caller overwrites run.state / run.error and destroys
    // the first caller's error code (observed: 'tab-closed' → 'cancelled' or
    // 'run-finalized'). First finalize wins.
    if (this.isRunFinalized(run)) {
      return;
    }
    run.state = state;
    run.error = error;
    run.endedAt = Date.now();
    this.clearInFlightAtomic(run);
    this.cancelPendingRequests(run.runId, new RunnerError('run-finalized', `Run finalized as ${state}.`));
    if (state === 'succeeded') {
      this.appendLog(run, 'success', 'Run succeeded.');
    } else if (state === 'cancelled') {
      this.appendLog(run, 'info', 'Run cancelled.');
    } else if (state === 'failed') {
      this.appendLog(
        run,
        'error',
        `Run failed: ${error?.message || error?.code || 'unknown error'}.`,
        { stepId: run.currentStepId },
      );
    }
    this.appendLog(run, 'info', `finalize: run ${state}`);
    this.releaseActiveRun(run);
    // 1.13 — delete the run sentinel IMMEDIATELY on finalize, NOT inside
    // scheduleCleanup (60s delay). Putting the remove in scheduleCleanup
    // would leave an already-terminal run observable as an orphan if the
    // SW suspended during that 60s window — next cold-start would
    // broadcast a ghost failed FLOW_RUN_STATUS for a run the user already
    // saw complete. We first write the terminal state to the sentinel so
    // even if the delete IPC is lost to an SW-suspend race, orphan
    // cleanup sees state != queued/running and skips broadcast.
    this.refreshRunSentinel(run);
    removeRunSentinel(run.runId);
    this.emitStatus(run, true);
    this.scheduleCleanup(run);
  }

  private markStepCompleted(run: FlowRunInternal) {
    run.progress.completedSteps += 1;
    if (run.progress.completedSteps > run.progress.totalSteps) {
      run.progress.totalSteps = run.progress.completedSteps;
    }
    // 1.13 — keep sentinel progress roughly current; orphan status can
    // show "stopped at step N of M" instead of "N of 0".
    this.refreshRunSentinel(run);
    this.emitStatus(run, true);
  }

  private async executeRun(run: FlowRunInternal) {
    run.state = 'running';
    // 1.13 — state transition queued→running; update sentinel.
    this.refreshRunSentinel(run);
    this.appendLog(run, 'info', 'Run started.');
    this.emitStatus(run, true);
    try {
      await this.executeSteps(run, run.flow.steps, this.createRenderContext(run));
      if (run.cancelRequested) {
        this.finalizeRun(run, 'cancelled');
        return;
      }
      this.finalizeRun(run, 'succeeded');
    } catch (error) {
      if (run.cancelRequested) {
        this.finalizeRun(run, 'cancelled');
        return;
      }
      const code = error instanceof RunnerError ? error.code : 'run-exception';
      const message = error instanceof Error ? error.message : String(error);
      this.finalizeRun(run, 'failed', {
        code,
        message,
        phase: error instanceof RunnerError ? error.phase : undefined,
        recoverable: error instanceof RunnerError ? error.recoverable : undefined,
      });
    }
  }

  private createRenderContext(
    run: FlowRunInternal,
    context?: Partial<Omit<FlowRenderContext, 'variables'>>,
  ): FlowRenderContext {
    return {
      row: context?.row,
      loop: context?.loop,
      variables: run.variables,
    };
  }

  private withLoopContext(run: FlowRunInternal, context: FlowRenderContext, index: number): FlowRenderContext {
    return this.createRenderContext(run, {
      row: context.row,
      loop: { index },
    });
  }

  private withRowContext(run: FlowRunInternal, context: FlowRenderContext, row: FlowRowContext): FlowRenderContext {
    return this.createRenderContext(run, {
      row,
      loop: context.loop,
    });
  }

  private async executeSteps(run: FlowRunInternal, steps: FlowStepData[], context: FlowRenderContext) {
    for (const step of steps) {
      this.ensureRunHealthy(run);
      run.currentStepId = step.id;
      // 1.13 — refresh sentinel so orphan broadcast can name the step the
      // run was paused on.
      this.refreshRunSentinel(run);
      this.appendLog(run, 'info', `Start step: ${step.type} (${step.id}).`, {
        stepId: step.id,
        stepType: step.type as FlowRunLogEntry['stepType'],
      });
      this.emitStatus(run, false);
      await this.executeStep(run, step, context);
    }
  }

  private async executeStep(run: FlowRunInternal, step: FlowStepData, context: FlowRenderContext) {
    run.executedStepCount += 1;
    this.ensureRunHealthy(run);
    if (step.type === 'click') {
      await this.executeAtomicStep(run, step, 'click', context);
      return;
    }
    if (step.type === 'input') {
      await this.executeAtomicStep(run, step, 'input', context);
      return;
    }
    if (step.type === 'wait') {
      await this.executeAtomicStep(run, step, 'wait', context);
      return;
    }
    if (step.type === 'assert') {
      await this.executeAtomicStep(run, step, 'assert', context);
      return;
    }
    if (step.type === 'popup') {
      await this.executeAtomicStep(run, step, 'popup', context);
      return;
    }
    if (step.type === 'navigate') {
      await this.executeNavigateStep(run, step, context);
      this.markStepCompleted(run);
      return;
    }
    if (step.type === 'set-variable') {
      await this.executeSetVariableStep(run, step, context);
      return;
    }
    if (step.type === 'loop') {
      const iterationsValue = getRenderedStepFieldValue(step, 'iterations', context);
      const iterations = toNonNegativeInteger(iterationsValue, -1);
      if (iterations < 0) {
        throw new RunnerError('invalid-loop-iterations', 'Loop iterations must be a non-negative integer.');
      }
      if (iterations > MAX_LOOP_ITERATIONS) {
        throw new RunnerError(
          'loop-iterations-exceeded',
          `Loop iterations ${iterations} exceeds the cap of ${MAX_LOOP_ITERATIONS}.`,
          { phase: 'execute', recoverable: false },
        );
      }
      this.appendLog(run, 'info', `Loop iterations: ${iterations}.`, {
        stepId: step.id,
        stepType: 'loop',
      });
      const children = Array.isArray(step.children) ? step.children : [];
      for (let index = 0; index < iterations; index += 1) {
        this.ensureRunHealthy(run);
        this.appendLog(run, 'info', `Loop round ${index + 1}/${iterations}.`, {
          stepId: step.id,
          stepType: 'loop',
        });
        await this.executeSteps(run, children, this.withLoopContext(run, context, index));
      }
      return;
    }
    if (step.type === 'if-else') {
      const condition = await this.executeConditionStep(run, step, context);
      const branches = selectIfElseBranches(step);
      this.appendLog(run, 'info', `If/Else branch: ${condition ? 'then' : 'else'}.`, {
        stepId: step.id,
        stepType: 'if-else',
      });
      if (condition) {
        await this.executeSteps(run, branches.thenSteps, context);
      } else {
        await this.executeSteps(run, branches.elseSteps, context);
      }
      return;
    }
    if (step.type === 'data-source') {
      await this.executeDataSourceStep(run, step, context);
      return;
    }
    throw new RunnerError('unsupported-step-type', `Unsupported step type: ${step.type}`);
  }

  private async executeSetVariableStep(run: FlowRunInternal, step: FlowStepData, context: FlowRenderContext) {
    const variableName = getStepFieldRawValue(step, 'name').trim();
    if (!VARIABLE_NAME_PATTERN.test(variableName)) {
      throw new RunnerError(
        'invalid-variable-name',
        'Variable name must start with a letter or underscore and contain only letters, numbers, or underscores.',
        { phase: 'execute', recoverable: false },
      );
    }
    this.appendLog(run, 'info', `Set variable "${truncateForLog(variableName)}".`, {
      stepId: step.id,
      stepType: 'set-variable',
    });
    let resolvedValue = '';
    // 1.5 — track whether the assigned value is secret-derived. Set=add,
    // clean=delete. Self-assignment of a tainted var ({{var.x}} → x) is
    // naturally sound: resolve → tainted=true → add (no-op since already in set).
    let assignedTainted = false;
    const selectorValue = getStepFieldRawValue(step, 'selector').trim();
    const sourceModeRaw = getStepFieldRawValue(step, 'sourceMode').trim();
    const sourceMode =
      sourceModeRaw === 'selector' || sourceModeRaw === 'value'
        ? sourceModeRaw
        : selectorValue
          ? 'selector'
          : 'value';
    if (sourceMode === 'selector') {
      const readBuilt = await this.buildReadPayload(run, step, context);
      const result = await this.invokeContentStep(run, readBuilt.payload);
      if (!result.ok) {
        this.appendLog(
          run,
          'error',
          `Variable read failed: ${result.error || result.errorCode || 'execution failed'}.`,
          { stepId: step.id, stepType: 'set-variable' },
        );
        throw new RunnerError(
          result.errorCode || 'step-execution-failed',
          result.error || 'Step execution failed.',
          { phase: 'execute', recoverable: false },
        );
      }
      resolvedValue = result.actual || '';
      // 1.6 — DOM read of a sensitive field (password/cc/OTP) taints the
      // destination variable. Also taint if the resolved selector itself
      // came from a tainted source (unusual but possible via {{var.X}}).
      assignedTainted = Boolean(result.sensitive) || readBuilt.taintedFields.has('selector');
    } else {
      const resolved = await this.resolveStepFieldValueWithVaultUnlock(
        run,
        step,
        'value',
        context,
        'set-variable',
      );
      resolvedValue = resolved.value;
      assignedTainted = resolved.tainted;
    }
    context.variables[variableName] = resolvedValue;
    if (assignedTainted) {
      run.taintedVariables.add(variableName);
    } else {
      run.taintedVariables.delete(variableName);
    }
    this.appendLog(run, 'success', `Variable "${truncateForLog(variableName)}" updated.`, {
      stepId: step.id,
      stepType: 'set-variable',
    });
    this.markStepCompleted(run);
  }

  private async buildReadPayload(
    run: FlowRunInternal,
    step: FlowStepData,
    context: FlowRenderContext,
  ): Promise<BuiltAtomicPayload> {
    const resolvedSelector = await this.resolveStepFieldValueWithVaultUnlock(
      run,
      step,
      'selector',
      context,
      'set-variable',
    );
    const taintedFields = new Set<TaintedPayloadField>();
    if (resolvedSelector.tainted) {
      taintedFields.add('selector');
    }
    return {
      payload: {
        runId: '',
        requestId: '',
        attempt: 0,
        stepId: step.id,
        stepType: 'read',
        selector: resolvedSelector.value,
        timeoutMs: STEP_ACTION_TIMEOUT_MS,
        pollIntervalMs: CONDITION_POLL_INTERVAL_MS,
      },
      taintedFields,
    };
  }

  private async resolveStepFieldValueWithVaultUnlock(
    run: FlowRunInternal,
    step: FlowStepData,
    fieldId: string,
    context: FlowRenderContext,
    stepType: FlowRunLogEntry['stepType'],
  ): Promise<ResolvedFieldValue> {
    try {
      return await this.resolveStepFieldValue(run, step, fieldId, context);
    } catch (error) {
      if (!(error instanceof RunnerError) || error.code !== 'secret-vault-locked') {
        throw error;
      }
    }

    let promptAttempt = 0;
    let promptErrorMessage = '';
    while (true) {
      this.ensureRunHealthy(run);
      promptAttempt += 1;
      this.appendLog(run, 'info', 'Waiting for password vault unlock on page.', {
        stepId: step.id,
        stepType,
      });
      const promptResult = await this.requestVaultUnlockPromptOnPage(run, step, {
        attempt: promptAttempt,
        errorMessage: promptErrorMessage || undefined,
      });

      if (promptResult.action === 'cancel') {
        this.appendLog(run, 'info', 'Vault unlock cancelled by user.', {
          stepId: step.id,
          stepType,
        });
        throw new RunnerError(
          'secret-vault-unlock-cancelled',
          'Password vault unlock was cancelled by the user.',
          { phase: 'execute', recoverable: false },
        );
      }
      if (promptResult.action === 'navigation') {
        this.appendLog(run, 'info', 'Vault unlock prompt interrupted by navigation.', {
          stepId: step.id,
          stepType,
        });
        throw new RunnerError(
          'secret-vault-unlock-interrupted',
          'Password vault unlock was interrupted by navigation.',
          { phase: 'execute', recoverable: true },
        );
      }

      try {
        await unlockSecretsVault(promptResult.password);
        this.appendLog(run, 'success', 'Password vault unlocked. Continuing run.', {
          stepId: step.id,
          stepType,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/invalid master password/i.test(message)) {
          promptErrorMessage = 'Invalid master password.';
          continue;
        }
        if (/master password is required/i.test(message)) {
          promptErrorMessage = 'Master password is required.';
          continue;
        }
        throw new RunnerError('secret-vault-unlock-prompt-unavailable', message, {
          phase: 'execute',
          recoverable: false,
        });
      }

      try {
        return await this.resolveStepFieldValue(run, step, fieldId, context);
      } catch (error) {
        if (error instanceof RunnerError && error.code === 'secret-vault-locked') {
          promptErrorMessage = 'Password vault is still locked. Please try again.';
          continue;
        }
        throw error;
      }
    }
  }

  private async executeAtomicStep(
    run: FlowRunInternal,
    step: FlowStepData,
    stepType: Exclude<FlowRunAtomicStepType, 'condition'>,
    context: FlowRenderContext,
  ) {
    let built: BuiltAtomicPayload;
    try {
      built = await this.buildAtomicPayload(run, step, stepType, context);
    } catch (error) {
      if (!(error instanceof RunnerError) || error.code !== 'secret-vault-locked') {
        throw error;
      }
      built = await this.promptVaultUnlockAndRetry(run, step, stepType, context);
    }
    this.appendLog(run, 'info', this.formatAtomicStartMessage(stepType, built.payload, built.taintedFields), {
      stepId: step.id,
      stepType,
    });
    const result = await this.invokeContentStep(run, built.payload);
    if (!result.ok) {
      this.appendLog(
        run,
        'error',
        `Step failed: ${result.error || result.errorCode || 'execution failed'}.`,
        { stepId: step.id, stepType },
      );
      throw new RunnerError(result.errorCode || 'step-execution-failed', result.error || 'Step execution failed.', {
        phase: 'execute',
        recoverable: false,
      });
    }
    this.appendLog(run, 'success', this.formatAtomicSuccessMessage(stepType, built.payload, result, built.taintedFields), {
      stepId: step.id,
      stepType,
    });
    this.markStepCompleted(run);
  }

  private async promptVaultUnlockAndRetry(
    run: FlowRunInternal,
    step: FlowStepData,
    stepType: Exclude<FlowRunAtomicStepType, 'condition'>,
    context: FlowRenderContext,
  ): Promise<BuiltAtomicPayload> {
    let promptAttempt = 0;
    let promptErrorMessage = '';
    while (true) {
      this.ensureRunHealthy(run);
      promptAttempt += 1;
      this.appendLog(run, 'info', 'Waiting for password vault unlock on page.', {
        stepId: step.id,
        stepType,
      });
      const promptResult = await this.requestVaultUnlockPromptOnPage(run, step, {
        attempt: promptAttempt,
        errorMessage: promptErrorMessage || undefined,
      });

      if (promptResult.action === 'cancel') {
        this.appendLog(run, 'info', 'Vault unlock cancelled by user.', {
          stepId: step.id,
          stepType,
        });
        throw new RunnerError(
          'secret-vault-unlock-cancelled',
          'Password vault unlock was cancelled by the user.',
          { phase: 'execute', recoverable: false },
        );
      }
      if (promptResult.action === 'navigation') {
        this.appendLog(run, 'info', 'Vault unlock prompt interrupted by navigation.', {
          stepId: step.id,
          stepType,
        });
        throw new RunnerError(
          'secret-vault-unlock-interrupted',
          'Password vault unlock was interrupted by navigation.',
          { phase: 'execute', recoverable: true },
        );
      }

      try {
        await unlockSecretsVault(promptResult.password);
        this.appendLog(run, 'success', 'Password vault unlocked. Continuing run.', {
          stepId: step.id,
          stepType,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/invalid master password/i.test(message)) {
          promptErrorMessage = 'Invalid master password.';
          continue;
        }
        if (/master password is required/i.test(message)) {
          promptErrorMessage = 'Master password is required.';
          continue;
        }
        throw new RunnerError('secret-vault-unlock-prompt-unavailable', message, {
          phase: 'execute',
          recoverable: false,
        });
      }

      try {
        return await this.buildAtomicPayload(run, step, stepType, context);
      } catch (error) {
        if (error instanceof RunnerError && error.code === 'secret-vault-locked') {
          promptErrorMessage = 'Password vault is still locked. Please try again.';
          continue;
        }
        throw error;
      }
    }
  }

  private async requestVaultUnlockPromptOnPage(
    run: FlowRunInternal,
    step: FlowStepData,
    options: { attempt: number; errorMessage?: string },
  ): Promise<FlowRunVaultUnlockPromptResult> {
    const payload: FlowRunVaultUnlockPromptPayload = {
      runId: run.runId,
      stepId: step.id,
      stepTitle: step.title || undefined,
      flowName: run.flow.name || undefined,
      siteKey: run.siteKey || undefined,
      attempt: options.attempt,
      errorMessage: options.errorMessage,
      reason: 'secret-vault-locked',
    };
    const message: RuntimeMessage = {
      type: MessageType.FLOW_RUN_VAULT_UNLOCK_PROMPT,
      data: payload,
    };

    const topLevelResponse = await this.tabBridge.sendMessageToTabWithRetry(run.tabId, message, true, { frameId: 0 });
    let response = topLevelResponse;
    if (
      (!response.ok || !isVaultUnlockPromptResult(response.data)) &&
      typeof run.targetFrameId === 'number' &&
      run.targetFrameId !== 0
    ) {
      response = await this.tabBridge.sendMessageToTabWithRetry(run.tabId, message, true, {
        frameId: run.targetFrameId,
      });
    }

    if (!response.ok) {
      const errorMessage = response.error || 'Failed to show vault unlock prompt on page.';
      const code =
        /message channel|receiving end does not exist|asynchronous response|before a response was received/i.test(
          errorMessage,
        )
          ? 'secret-vault-unlock-interrupted'
          : 'secret-vault-unlock-prompt-unavailable';
      throw new RunnerError(code, errorMessage, { phase: 'dispatch', recoverable: true });
    }
    if (!isVaultUnlockPromptResult(response.data)) {
      throw new RunnerError(
        'secret-vault-unlock-prompt-unavailable',
        'Invalid vault unlock prompt response from content script.',
        { phase: 'dispatch', recoverable: false },
      );
    }
    return response.data;
  }

  private async executeConditionStep(run: FlowRunInternal, step: FlowStepData, context: FlowRenderContext) {
    // NOTE: condition path currently does NOT go through promptVaultUnlockAndRetry.
    // That gap (if a secret token resolves during condition build and the vault
    // is locked, the condition fails hard instead of prompting unlock) is a
    // pre-existing issue flagged in the original review; intentionally not
    // changed in batch 5 to avoid conflating fixes. Separate ticket.
    const built = await this.buildAtomicPayload(run, step, 'condition', context);
    this.appendLog(run, 'info', this.formatAtomicStartMessage('condition', built.payload, built.taintedFields), {
      stepId: step.id,
      stepType: 'condition',
    });
    const result = await this.invokeContentStep(run, built.payload);
    if (!result.ok) {
      this.appendLog(
        run,
        'error',
        `Condition check failed: ${result.error || result.errorCode || 'execution failed'}.`,
        { stepId: step.id, stepType: 'condition' },
      );
      throw new RunnerError(result.errorCode || 'condition-check-failed', result.error || 'Condition check failed.', {
        phase: 'execute',
        recoverable: false,
      });
    }
    this.appendLog(run, 'success', this.formatAtomicSuccessMessage('condition', built.payload, result, built.taintedFields), {
      stepId: step.id,
      stepType: 'condition',
    });
    this.markStepCompleted(run);
    return Boolean(result.conditionMatched);
  }

  // 1.5 — returns the resolved string AND whether it is secret-derived.
  // Taint sources: raw field text contains any `{{secret.X}}`, raw field
  // text contains `{{var.Y}}` where Y is in run.taintedVariables, OR the
  // field has a JS transform whose input was tainted.
  // Declassify is intentionally NOT exposed here — if we ever want it, it
  // should be a standalone `declassify` step type so the sidepanel can
  // audit it; a flag hidden inside a JS transform config would be too easy
  // to miss.
  private async resolveStepFieldValue(
    run: FlowRunInternal,
    step: FlowStepData,
    fieldId: string,
    context: FlowRenderContext,
  ): Promise<ResolvedFieldValue> {
    const rawValue = getStepFieldRawValue(step, fieldId);
    const inputTainted = isRawFieldTainted(rawValue, run.taintedVariables);
    const renderedValue = getRenderedStepFieldValue(step, fieldId, context);
    let resolvedValue = renderedValue;
    try {
      resolvedValue = await resolveSecretTokens(renderedValue);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorCode = 'secret-resolution-error';
      if (/secret vault is locked/i.test(errorMessage)) {
        errorCode = 'secret-vault-locked';
      } else if (/secret not found/i.test(errorMessage)) {
        errorCode = 'secret-not-found';
      }
      throw new RunnerError(errorCode, `Secret resolution failed for ${fieldId}: ${errorMessage}`);
    }
    const field = getStepField(step, fieldId);
    const noTransform =
      !field?.transform ||
      field.transform.mode !== 'js' ||
      field.transform.enabled === false ||
      !field.transform.code.trim();
    if (noTransform) {
      return { value: resolvedValue, tainted: inputTainted };
    }
    try {
      // Second taint channel (beyond the raw field's {{var.X}} / {{secret.X}}
      // tokens): the transform's sandbox gets `variables` directly. Code like
      // `return variables.x` would extract a tainted var's plaintext without
      // any token appearing in the raw field — isRawFieldTainted would see
      // nothing and the output would be released as untainted. Replace
      // tainted entries with [REDACTED] before handing the map to the
      // sandbox. User code still gets something readable (not undefined,
      // so conditionals on variables.x won't crash), but never the plaintext.
      // row/loop are not taint sources and pass through untouched.
      const sandboxVariables: Record<string, string> = {};
      for (const [name, value] of Object.entries(context.variables)) {
        sandboxVariables[name] = run.taintedVariables.has(name)
          ? REDACTED_PLACEHOLDER
          : value;
      }
      const transformed = await this.jsTransformExecutor.run({
        code: field!.transform!.code.trim(),
        value: resolvedValue,
        row: context.row,
        loop: context.loop,
        variables: sandboxVariables,
        timeoutMs: field!.transform!.timeoutMs,
      });
      // Strictest propagation: transform preserves taint. Cannot prove the
      // user's transform stripped the secret (e.g. `return input.slice(0,4)`
      // still leaks 4 chars). Declassify → standalone step, out of scope.
      return { value: transformed, tainted: inputTainted };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new RunnerError('input-transform-error', `JS transform failed for ${fieldId}: ${errorMessage}`);
    }
  }

  private async buildAtomicPayload(
    run: FlowRunInternal,
    step: FlowStepData,
    stepType: FlowRunAtomicStepType,
    context: FlowRenderContext,
  ): Promise<BuiltAtomicPayload> {
    const payload: FlowRunExecuteStepPayload = {
      runId: '',
      requestId: '',
      attempt: 0,
      stepId: step.id,
      stepType,
      timeoutMs: STEP_ACTION_TIMEOUT_MS,
      pollIntervalMs: CONDITION_POLL_INTERVAL_MS,
    };
    const taintedFields = new Set<TaintedPayloadField>();
    const assign = (field: TaintedPayloadField, resolved: ResolvedFieldValue) => {
      if (resolved.tainted) {
        taintedFields.add(field);
      }
      return resolved.value;
    };

    if (stepType === 'click') {
      payload.selector = assign('selector', await this.resolveStepFieldValue(run, step, 'selector', context));
    } else if (stepType === 'input') {
      payload.selector = assign('selector', await this.resolveStepFieldValue(run, step, 'selector', context));
      const resolvedInputValue = await this.resolveStepFieldValue(run, step, 'value', context);
      payload.value = assign('value', resolvedInputValue);
      // 1.5/1.6 — `valueSource: 'secret'` must reflect the full taint story,
      // not only the narrow raw-token match. The content-side password gate
      // is `valueSource !== 'secret' && !isSecretTokenValue(nextValue)`; if
      // we only set 'secret' on exact `{{secret.X}}` raw match, these legit
      // flows all hit password-literal-blocked:
      //   - `{{var.X}}` where X is a tainted variable (e.g. set-variable
      //     from a secret, or from an executeRead on a sensitive DOM field)
      //   - JS transform whose input was secret-derived
      //   - composed templates like `prefix-{{secret.Y}}-suffix`
      // resolved.tainted is the authoritative taint flag — use it.
      payload.valueSource = resolvedInputValue.tainted ? 'secret' : 'literal';
    } else if (stepType === 'popup') {
      payload.message = assign('message', await this.resolveStepFieldValue(run, step, 'message', context));
    } else if (stepType === 'wait') {
      // Mode / operator / duration are structural; they don't carry taint
      // semantics and structurally shouldn't be secret-derived. We don't
      // pipe them through the taint tracker.
      const modeResolved = await this.resolveStepFieldValue(run, step, 'mode', context);
      const modeValue = modeResolved.value;
      const mode =
        modeValue === 'condition' ||
        modeValue === 'appear' ||
        modeValue === 'disappear' ||
        modeValue === 'time'
          ? modeValue
          : '';
      if (!mode) {
        throw new RunnerError(
          'invalid-wait-mode',
          'Wait step mode must be one of "time", "condition", "appear", or "disappear".',
        );
      }
      payload.mode = mode;
      if (mode === 'time') {
        const durationResolved = await this.resolveStepFieldValue(run, step, 'duration', context);
        payload.durationMs = toNonNegativeInteger(durationResolved.value, 0);
      } else if (mode === 'condition') {
        payload.timeoutMs = WAIT_SELECTOR_TIMEOUT_MS;
        payload.selector = assign('selector', await this.resolveStepFieldValue(run, step, 'selector', context));
        const operatorResolved = await this.resolveStepFieldValue(run, step, 'operator', context);
        const operator = operatorResolved.value;
        payload.operator =
          operator === 'equals' || operator === 'greater' || operator === 'less' ? operator : 'contains';
        payload.expected = assign('expected', await this.resolveStepFieldValue(run, step, 'expected', context));
      } else {
        payload.timeoutMs = WAIT_SELECTOR_TIMEOUT_MS;
        payload.selector = assign('selector', await this.resolveStepFieldValue(run, step, 'selector', context));
      }
    } else if (stepType === 'assert' || stepType === 'condition') {
      payload.selector = assign('selector', await this.resolveStepFieldValue(run, step, 'selector', context));
      const operatorResolved = await this.resolveStepFieldValue(run, step, 'operator', context);
      const operator = operatorResolved.value;
      payload.operator =
        operator === 'equals' || operator === 'greater' || operator === 'less' ? operator : 'contains';
      payload.expected = assign('expected', await this.resolveStepFieldValue(run, step, 'expected', context));
    }

    return { payload, taintedFields };
  }

  private async invokeContentStep(
    run: FlowRunInternal,
    payload: FlowRunExecuteStepPayload,
  ): Promise<FlowRunExecuteResultPayload> {
    const deadline = Date.now() + STEP_MESSAGE_RETRY_TIMEOUT_MS;
    let lastTransportError = '';
    let attempt = 0;
    const stepStartUrl = run.activeUrl;
    try {
      while (Date.now() < deadline) {
        this.ensureRunHealthy(run);
        attempt += 1;
        const requestId = this.nextStepRequestId(run, payload.stepId);
        const requestPayload: FlowRunExecuteStepPayload = {
          ...payload,
          runId: run.runId,
          requestId,
          attempt,
          targetFrameId: run.targetFrameId,
          topFrameOnly: typeof run.targetFrameId === 'number' ? false : true,
        };
        run.inFlightAtomic = {
          stepId: payload.stepId,
          stepType: payload.stepType,
          payload: requestPayload,
          attempt,
          currentRequestId: requestId,
          stepStartUrl,
          lastKnownUrl: run.activeUrl || stepStartUrl,
          deadlineAt: deadline,
          startedAt: Date.now(),
          status: 'dispatched',
        };
        const response = await this.tabBridge.sendMessageToTabWithRetry(
          run.tabId,
          {
            type: MessageType.FLOW_RUN_EXECUTE_STEP,
            data: requestPayload,
          },
          true,
          typeof run.targetFrameId === 'number' ? { frameId: run.targetFrameId } : undefined,
        );
        if (!response.ok) {
          lastTransportError = response.error || 'Failed to dispatch step to content script.';
          if (!isRecoverableTabMessageError(lastTransportError)) {
            throw new RunnerError('content-message-failed', lastTransportError, {
              phase: 'dispatch',
              recoverable: false,
            });
          }
          if (Date.now() >= deadline) {
            break;
          }
          await new Promise<void>((resolve) => {
            setTimeout(resolve, STEP_MESSAGE_RETRY_INTERVAL_MS);
          });
          continue;
        }

        if (run.inFlightAtomic?.status === 'superseded') {
          continue;
        }

        const remaining = Math.max(0, deadline - Date.now());
        if (remaining <= 0) {
          break;
        }
        const perAttemptTimeoutMs = this.getStepResultWaitTimeoutMs(payload, remaining);
        if (perAttemptTimeoutMs <= 0) {
          break;
        }
        if (run.inFlightAtomic) {
          run.inFlightAtomic.status = 'awaiting_result';
          run.inFlightAtomic.lastKnownUrl = run.activeUrl || run.inFlightAtomic.lastKnownUrl;
        }
        try {
          return await this.waitForStepResult({
            requestId,
            runId: run.runId,
            stepId: payload.stepId,
            stepType: payload.stepType,
            timeoutMs: perAttemptTimeoutMs,
          });
        } catch (error) {
          if (error instanceof RunnerError && error.code === 'step-request-superseded') {
            if (payload.stepType === 'popup' && error.message === 'popup-refresh-dismissed') {
              throw new RunnerError(
                'popup-dismissed-by-navigation',
                'Popup step was dismissed because the page refreshed or navigated.',
                { phase: 'result-wait', recoverable: true },
              );
            }
            const recoverUrl = run.activeUrl || run.inFlightAtomic?.lastKnownUrl || stepStartUrl;
            this.appendLog(
              run,
              'info',
              `recover: retry attempt ${attempt + 1} on ${truncateForLog(recoverUrl || 'current page')}`,
              {
                stepId: payload.stepId,
                stepType: payload.stepType,
              },
            );
            continue;
          }
          if (!(error instanceof RunnerError) || error.code !== 'step-result-timeout') {
            throw error;
          }
          const liveTab = await this.tabBridge.getTabById(run.tabId);
          const liveUrl = liveTab?.url || run.activeUrl;
          if (liveUrl && liveUrl !== run.activeUrl) {
            this.updateRunActiveUrl(run, liveUrl);
          }
          const currentUrl = liveUrl || run.activeUrl;
          const isSameSiteAfterTimeout = Boolean(currentUrl) && deriveSiteKeyFromUrl(currentUrl) === run.siteKey;
          const hasNavigationAfterTimeout = Boolean(currentUrl && stepStartUrl && currentUrl !== stepStartUrl);

          if (payload.stepType === 'click' && isSameSiteAfterTimeout && hasNavigationAfterTimeout) {
            this.appendLog(run, 'info', 'recover: click treated success due navigation', {
              stepId: payload.stepId,
              stepType: payload.stepType,
            });
            return {
              ok: true,
              runId: run.runId,
              requestId,
              stepId: payload.stepId,
              stepType: payload.stepType,
              details: {
                selector: payload.selector,
                elementText: 'navigation-likely',
              },
            };
          }

          const isRetryableAtomicStep =
            payload.stepType === 'input' ||
            payload.stepType === 'wait' ||
            payload.stepType === 'assert' ||
            payload.stepType === 'condition' ||
            payload.stepType === 'popup';
          const canRetryAfterTimeout =
            isRetryableAtomicStep &&
            isSameSiteAfterTimeout &&
            (payload.stepType === 'wait' || hasNavigationAfterTimeout);
          if (canRetryAfterTimeout) {
            this.appendLog(
              run,
              'info',
              `recover: retry attempt ${attempt + 1} on ${truncateForLog(currentUrl || 'current page')}`,
              {
                stepId: payload.stepId,
                stepType: payload.stepType,
              },
            );
            continue;
          }
          throw error;
        }
      }

      throw new RunnerError(
        'content-message-timeout',
        `Timed out after ${STEP_MESSAGE_RETRY_TIMEOUT_MS}ms while dispatching step: ${lastTransportError || 'unknown transport error'}`,
        { phase: 'dispatch', recoverable: true },
      );
    } finally {
      this.clearInFlightAtomic(run, payload.stepId);
    }
  }

  private getStepResultWaitTimeoutMs(payload: FlowRunExecuteStepPayload, remainingMs: number) {
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      return 0;
    }
    const normalizedRemaining = Math.max(0, Math.floor(remainingMs));
    const normalizePositive = (value: number) =>
      Number.isFinite(value) ? Math.max(STEP_RESULT_WAIT_MIN_MS, Math.floor(value)) : STEP_RESULT_WAIT_MIN_MS;
    const clampToRemaining = (value: number) => {
      if (normalizedRemaining < STEP_RESULT_WAIT_MIN_MS) {
        return normalizedRemaining;
      }
      return Math.min(normalizedRemaining, normalizePositive(value));
    };

    if (payload.stepType === 'popup') {
      return normalizedRemaining;
    }

    const defaultTimeoutMs = toNonNegativeInteger(String(payload.timeoutMs ?? STEP_ACTION_TIMEOUT_MS), STEP_ACTION_TIMEOUT_MS);
    const baseTimeoutMs = defaultTimeoutMs + STEP_RESULT_WAIT_GRACE_MS;
    if (payload.stepType === 'wait' && payload.mode === 'time') {
      const durationMs = toNonNegativeInteger(String(payload.durationMs ?? 0), 0);
      const waitTimeoutMs = Math.max(defaultTimeoutMs, durationMs) + STEP_RESULT_WAIT_GRACE_MS;
      return clampToRemaining(waitTimeoutMs);
    }
    return clampToRemaining(baseTimeoutMs);
  }

  private waitForStepResult(params: {
    requestId: FlowRunStepRequestId;
    runId: string;
    stepId: string;
    stepType: FlowRunAtomicStepType;
    timeoutMs: number;
  }): Promise<FlowRunExecuteResultPayload> {
    return new Promise<FlowRunExecuteResultPayload>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingStepRequests.delete(params.requestId);
        reject(
          new RunnerError(
            'step-result-timeout',
            `Timed out waiting for step result: ${params.stepType} (${params.stepId})`,
            { phase: 'result-wait', recoverable: false },
          ),
        );
      }, params.timeoutMs);
      this.pendingStepRequests.set(params.requestId, {
        runId: params.runId,
        stepId: params.stepId,
        stepType: params.stepType,
        timeoutHandle,
        resolve,
        reject,
      });
    });
  }

  private async executeNavigateStep(run: FlowRunInternal, step: FlowStepData, context: FlowRenderContext) {
    const targetValue = getRenderedStepFieldValue(step, 'url', context).trim();
    if (!targetValue) {
      throw new RunnerError('navigate-url-missing', 'Navigate step URL is required.', {
        phase: 'navigate',
        recoverable: false,
      });
    }
    const tab = await this.tabBridge.getTabById(run.tabId);
    const baseUrl = run.activeUrl || tab?.url || '';
    let parsed: URL;
    try {
      parsed = new URL(targetValue, baseUrl || `https://${run.siteKey}`);
    } catch {
      throw new RunnerError('navigate-url-invalid', `Invalid navigate URL: ${targetValue}`, {
        phase: 'navigate',
        recoverable: false,
      });
    }
    // 2.1 — Explicit scheme allowlist. Without this, `javascript:`, `data:`,
    // `blob:`, `file:`, `chrome-extension:` etc. parse successfully; they
    // would typically fail the cross-site check below (deriveSiteKeyFromUrl
    // returns '' for non-http schemes) but that was defense-by-accident.
    // Make the intent explicit so future changes to deriveSiteKeyFromUrl
    // don't silently re-open this gap.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new RunnerError(
        'navigate-unsupported-scheme',
        `Navigate URL scheme "${parsed.protocol}" is not allowed.`,
        { phase: 'navigate', recoverable: false },
      );
    }
    const absoluteUrl = parsed.toString();
    this.appendLog(run, 'info', `Navigate to ${truncateForLog(absoluteUrl)}.`, {
      stepId: step.id,
      stepType: 'navigate',
    });
    const targetSite = deriveSiteKeyFromUrl(absoluteUrl);
    if (!targetSite || targetSite !== run.siteKey) {
      throw new RunnerError('cross-site-navigation', `Navigate target is outside site: ${absoluteUrl}`, {
        phase: 'navigate',
        recoverable: false,
      });
    }

    try {
      await this.tabBridge.updateTabUrl(run.tabId, absoluteUrl);
    } catch (error) {
      throw new RunnerError(
        'navigate-update-failed',
        error instanceof Error ? error.message : String(error),
        { phase: 'navigate', recoverable: false },
      );
    }

    let completedTab: { url?: string };
    try {
      completedTab = await this.tabBridge.waitForTabComplete(run.tabId, NAVIGATION_TIMEOUT_MS, (changeInfo) => {
        if (changeInfo.url) {
          this.updateRunActiveUrl(run, changeInfo.url);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new RunnerError('navigate-timeout', message, { phase: 'navigate', recoverable: true });
    }

    const landedUrl = completedTab.url || absoluteUrl;
    run.activeUrl = landedUrl;
    const landedSite = deriveSiteKeyFromUrl(landedUrl);
    if (!landedSite || landedSite !== run.siteKey) {
      throw new RunnerError('cross-site-navigation', `Navigation landed on another site: ${landedUrl}`, {
        phase: 'navigate',
        recoverable: false,
      });
    }
    this.appendLog(run, 'success', `Navigation completed at ${truncateForLog(landedUrl)}.`, {
      stepId: step.id,
      stepType: 'navigate',
    });
    this.ensureRunHealthy(run);
  }

  private async executeDataSourceStep(run: FlowRunInternal, step: FlowStepData, context: FlowRenderContext) {
    const children = Array.isArray(step.children) ? step.children : [];
    const selectedInput = run.dataSourceInputs[step.id];
    if (!selectedInput || !selectedInput.rawText.trim()) {
      throw new RunnerError(
        'data-source-input-missing',
        `Missing data source input for step ${step.id}.`,
      );
    }
    const expectedFileType = step.dataSource?.fileType === 'tsv' ? 'tsv' : 'csv';
    if (selectedInput.fileType !== expectedFileType) {
      throw new RunnerError(
        'data-source-mismatch',
        `Selected file type does not match recorded file type for step ${step.id}.`,
      );
    }
    const expectedRaw = normalizeDelimitedText(step.dataSource?.rawText || '');
    const actualRaw = normalizeDelimitedText(selectedInput.rawText);
    if (expectedRaw && expectedRaw !== actualRaw) {
      throw new RunnerError(
        'data-source-mismatch',
        `Selected CSV content does not match recorded content for step ${step.id}.`,
      );
    }
    const parsed = parseDataSourceRows(step, estimateFlowSteps(children), {
      rawText: selectedInput.rawText,
      fileType: selectedInput.fileType,
    });
    if (parsed.rows.length > MAX_LOOP_ITERATIONS) {
      throw new RunnerError(
        'data-source-rows-exceeded',
        `Data-source rows ${parsed.rows.length} exceeds the iteration cap of ${MAX_LOOP_ITERATIONS}.`,
        { phase: 'execute', recoverable: false },
      );
    }
    this.appendLog(run, 'info', `Data source rows: ${parsed.rows.length}.`, {
      stepId: step.id,
      stepType: 'data-source',
    });
    if (parsed.rows.length !== parsed.estimatedRows && parsed.rowStepWeight > 0) {
      const delta = (parsed.rows.length - parsed.estimatedRows) * parsed.rowStepWeight;
      run.progress.totalSteps = Math.max(run.progress.completedSteps, run.progress.totalSteps + delta);
      // 1.13 — data-source rows may differ from the static estimate;
      // keep sentinel totalSteps in sync so an orphan-failed status after
      // a mid-flight suspension reports the right step count.
      this.refreshRunSentinel(run);
      this.emitStatus(run, false);
    }
    for (let index = 0; index < parsed.rows.length; index += 1) {
      this.ensureRunHealthy(run);
      const currentRow = parsed.rows[index];
      const mergedRow = { ...(context.row ?? {}), ...currentRow, index: String(index) };
      await this.executeSteps(run, children, this.withRowContext(run, context, mergedRow));
      await microYield();
    }
  }
}
