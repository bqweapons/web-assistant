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
import { isSecretTokenValue, resolveSecretTokens, unlockSecretsVault } from '../../../shared/secrets';
import {
  getRenderedStepFieldValue,
  getStepField,
  getStepFieldRawValue,
  microYield,
  toNonNegativeInteger,
  truncateForLog,
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
  statusTimer?: ReturnType<typeof setTimeout>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  inFlightAtomic?: InFlightAtomicStep;
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
    step.type === 'navigate'
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

  constructor(options: FlowRunnerManagerOptions) {
    this.runtime = options.runtime;
    this.tabBridge = options.tabBridge;
    this.statusThrottleMs = options.statusThrottleMs ?? STATUS_THROTTLE_MS;
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
    };
    this.runs.set(runId, run);
    this.activeRunByTab.set(tabId, runId);
    this.appendLog(run, 'info', `Run queued for flow "${flow.name || flow.id}".`);
    this.emitStatus(run, true);
    void this.executeRun(run);
    return { runId };
  }

  stop(runId: string) {
    const run = this.runs.get(runId);
    if (!run) {
      throw new RunnerError('run-not-found', 'Run not found.');
    }
    if (run.state === 'succeeded' || run.state === 'failed' || run.state === 'cancelled') {
      return { runId };
    }
    run.cancelRequested = true;
    run.state = 'cancelled';
    run.endedAt = Date.now();
    this.clearInFlightAtomic(run);
    this.cancelPendingRequests(run.runId, new RunnerError('cancelled', 'Run cancelled.'));
    this.appendLog(run, 'info', 'Stop requested.');
    this.emitStatus(run, true);
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

  private formatAtomicStartMessage(stepType: FlowRunAtomicStepType, payload: FlowRunExecuteStepPayload) {
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
      return `Wait until "${truncateForLog(payload.selector || '')}" ${payload.operator || 'contains'} "${truncateForLog(payload.expected || '')}".`;
    }
    if (stepType === 'assert') {
      return `Assert "${truncateForLog(payload.selector || '')}" ${payload.operator || 'contains'} "${truncateForLog(payload.expected || '')}".`;
    }
    if (stepType === 'popup') {
      return `Show popup "${truncateForLog(payload.message || '')}".`;
    }
    if (stepType === 'condition') {
      return `Check condition on "${truncateForLog(payload.selector || '')}".`;
    }
    return `Execute ${stepType} step.`;
  }

  private formatAtomicSuccessMessage(
    stepType: FlowRunAtomicStepType,
    payload: FlowRunExecuteStepPayload,
    result: FlowRunExecuteResultPayload,
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
      return `Popup shown: "${truncateForLog(payload.message || details?.popupMessage || '')}".`;
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
  }

  private finalizeRun(run: FlowRunInternal, state: FlowRunState, error?: FlowRunError) {
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
    this.emitStatus(run, true);
    this.scheduleCleanup(run);
  }

  private markStepCompleted(run: FlowRunInternal) {
    run.progress.completedSteps += 1;
    if (run.progress.completedSteps > run.progress.totalSteps) {
      run.progress.totalSteps = run.progress.completedSteps;
    }
    this.emitStatus(run, true);
  }

  private async executeRun(run: FlowRunInternal) {
    run.state = 'running';
    this.appendLog(run, 'info', 'Run started.');
    this.emitStatus(run, true);
    try {
      await this.executeSteps(run, run.flow.steps);
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

  private async executeSteps(run: FlowRunInternal, steps: FlowStepData[], row?: FlowRowContext) {
    for (const step of steps) {
      this.ensureRunHealthy(run);
      run.currentStepId = step.id;
      this.appendLog(run, 'info', `Start step: ${step.type} (${step.id}).`, {
        stepId: step.id,
        stepType: step.type as FlowRunLogEntry['stepType'],
      });
      this.emitStatus(run, false);
      await this.executeStep(run, step, row);
    }
  }

  private async executeStep(run: FlowRunInternal, step: FlowStepData, row?: FlowRowContext) {
    if (step.type === 'click') {
      await this.executeAtomicStep(run, step, 'click', row);
      return;
    }
    if (step.type === 'input') {
      await this.executeAtomicStep(run, step, 'input', row);
      return;
    }
    if (step.type === 'wait') {
      await this.executeAtomicStep(run, step, 'wait', row);
      return;
    }
    if (step.type === 'assert') {
      await this.executeAtomicStep(run, step, 'assert', row);
      return;
    }
    if (step.type === 'popup') {
      await this.executeAtomicStep(run, step, 'popup', row);
      return;
    }
    if (step.type === 'navigate') {
      await this.executeNavigateStep(run, step, row);
      this.markStepCompleted(run);
      return;
    }
    if (step.type === 'loop') {
      const iterationsValue = getRenderedStepFieldValue(step, 'iterations', row);
      const iterations = toNonNegativeInteger(iterationsValue, -1);
      if (iterations < 0) {
        throw new RunnerError('invalid-loop-iterations', 'Loop iterations must be a non-negative integer.');
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
        await this.executeSteps(run, children, row);
      }
      return;
    }
    if (step.type === 'if-else') {
      const condition = await this.executeConditionStep(run, step, row);
      const branches = selectIfElseBranches(step);
      this.appendLog(run, 'info', `If/Else branch: ${condition ? 'then' : 'else'}.`, {
        stepId: step.id,
        stepType: 'if-else',
      });
      if (condition) {
        await this.executeSteps(run, branches.thenSteps, row);
      } else {
        await this.executeSteps(run, branches.elseSteps, row);
      }
      return;
    }
    if (step.type === 'data-source') {
      await this.executeDataSourceStep(run, step, row);
      return;
    }
    throw new RunnerError('unsupported-step-type', `Unsupported step type: ${step.type}`);
  }

  private async executeAtomicStep(
    run: FlowRunInternal,
    step: FlowStepData,
    stepType: Exclude<FlowRunAtomicStepType, 'condition'>,
    row?: FlowRowContext,
  ) {
    let payload: FlowRunExecuteStepPayload;
    try {
      payload = await this.buildAtomicPayload(step, stepType, row);
    } catch (error) {
      if (!(error instanceof RunnerError) || error.code !== 'secret-vault-locked') {
        throw error;
      }
      payload = await this.promptVaultUnlockAndRetry(run, step, stepType, row);
    }
    this.appendLog(run, 'info', this.formatAtomicStartMessage(stepType, payload), {
      stepId: step.id,
      stepType,
    });
    const result = await this.invokeContentStep(run, payload);
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
    this.appendLog(run, 'success', this.formatAtomicSuccessMessage(stepType, payload, result), {
      stepId: step.id,
      stepType,
    });
    this.markStepCompleted(run);
  }

  private async promptVaultUnlockAndRetry(
    run: FlowRunInternal,
    step: FlowStepData,
    stepType: Exclude<FlowRunAtomicStepType, 'condition'>,
    row?: FlowRowContext,
  ): Promise<FlowRunExecuteStepPayload> {
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
        return await this.buildAtomicPayload(step, stepType, row);
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

  private async executeConditionStep(run: FlowRunInternal, step: FlowStepData, row?: FlowRowContext) {
    const payload = await this.buildAtomicPayload(step, 'condition', row);
    this.appendLog(run, 'info', this.formatAtomicStartMessage('condition', payload), {
      stepId: step.id,
      stepType: 'condition',
    });
    const result = await this.invokeContentStep(run, payload);
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
    this.appendLog(run, 'success', this.formatAtomicSuccessMessage('condition', payload, result), {
      stepId: step.id,
      stepType: 'condition',
    });
    this.markStepCompleted(run);
    return Boolean(result.conditionMatched);
  }

  private async resolveStepFieldValue(step: FlowStepData, fieldId: string, row?: FlowRowContext) {
    const renderedValue = getRenderedStepFieldValue(step, fieldId, row);
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
    if (!field?.transform || field.transform.mode !== 'js') {
      return resolvedValue;
    }
    if (field.transform.enabled === false) {
      return resolvedValue;
    }
    const code = field.transform.code.trim();
    if (!code) {
      return resolvedValue;
    }
    try {
      return await this.jsTransformExecutor.run({
        code,
        value: resolvedValue,
        row,
        timeoutMs: field.transform.timeoutMs,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new RunnerError('input-transform-error', `JS transform failed for ${fieldId}: ${errorMessage}`);
    }
  }

  private async buildAtomicPayload(
    step: FlowStepData,
    stepType: FlowRunAtomicStepType,
    row?: FlowRowContext,
  ): Promise<FlowRunExecuteStepPayload> {
    const payload: FlowRunExecuteStepPayload = {
      runId: '',
      requestId: '',
      attempt: 0,
      stepId: step.id,
      stepType,
      timeoutMs: STEP_ACTION_TIMEOUT_MS,
      pollIntervalMs: CONDITION_POLL_INTERVAL_MS,
    };

    if (stepType === 'click') {
      payload.selector = await this.resolveStepFieldValue(step, 'selector', row);
    } else if (stepType === 'input') {
      const rawValue = getRenderedStepFieldValue(step, 'value', row);
      payload.selector = await this.resolveStepFieldValue(step, 'selector', row);
      payload.value = await this.resolveStepFieldValue(step, 'value', row);
      payload.valueSource = isSecretTokenValue(rawValue) ? 'secret' : 'literal';
    } else if (stepType === 'popup') {
      payload.message = await this.resolveStepFieldValue(step, 'message', row);
    } else if (stepType === 'wait') {
      const modeValue = await this.resolveStepFieldValue(step, 'mode', row);
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
        const durationValue = await this.resolveStepFieldValue(step, 'duration', row);
        payload.durationMs = toNonNegativeInteger(durationValue, 0);
      } else if (mode === 'condition') {
        payload.timeoutMs = WAIT_SELECTOR_TIMEOUT_MS;
        payload.selector = await this.resolveStepFieldValue(step, 'selector', row);
        const operator = await this.resolveStepFieldValue(step, 'operator', row);
        payload.operator =
          operator === 'equals' || operator === 'greater' || operator === 'less' ? operator : 'contains';
        payload.expected = await this.resolveStepFieldValue(step, 'expected', row);
      } else {
        payload.timeoutMs = WAIT_SELECTOR_TIMEOUT_MS;
        payload.selector = await this.resolveStepFieldValue(step, 'selector', row);
      }
    } else if (stepType === 'assert' || stepType === 'condition') {
      payload.selector = await this.resolveStepFieldValue(step, 'selector', row);
      const operator = await this.resolveStepFieldValue(step, 'operator', row);
      payload.operator =
        operator === 'equals' || operator === 'greater' || operator === 'less' ? operator : 'contains';
      payload.expected = await this.resolveStepFieldValue(step, 'expected', row);
    }

    return payload;
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

  private async executeNavigateStep(run: FlowRunInternal, step: FlowStepData, row?: FlowRowContext) {
    const targetValue = getRenderedStepFieldValue(step, 'url', row).trim();
    if (!targetValue) {
      throw new RunnerError('navigate-url-missing', 'Navigate step URL is required.', {
        phase: 'navigate',
        recoverable: false,
      });
    }
    const tab = await this.tabBridge.getTabById(run.tabId);
    const baseUrl = run.activeUrl || tab?.url || '';
    let absoluteUrl = '';
    try {
      absoluteUrl = new URL(targetValue, baseUrl || `https://${run.siteKey}`).toString();
    } catch {
      throw new RunnerError('navigate-url-invalid', `Invalid navigate URL: ${targetValue}`, {
        phase: 'navigate',
        recoverable: false,
      });
    }
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

  private async executeDataSourceStep(run: FlowRunInternal, step: FlowStepData, row?: FlowRowContext) {
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
    this.appendLog(run, 'info', `Data source rows: ${parsed.rows.length}.`, {
      stepId: step.id,
      stepType: 'data-source',
    });
    if (parsed.rows.length !== parsed.estimatedRows && parsed.rowStepWeight > 0) {
      const delta = (parsed.rows.length - parsed.estimatedRows) * parsed.rowStepWeight;
      run.progress.totalSteps = Math.max(run.progress.completedSteps, run.progress.totalSteps + delta);
      this.emitStatus(run, false);
    }
    for (const currentRow of parsed.rows) {
      this.ensureRunHealthy(run);
      const mergedRow = row ? { ...row, ...currentRow } : currentRow;
      await this.executeSteps(run, children, mergedRow);
      await microYield();
    }
  }
}
