import {
  MessageType,
  type FlowRunAtomicStepType,
  type FlowRunExecuteResultPayload,
  type FlowRunExecuteStepPayload,
  type FlowRunFlowSnapshot,
  type FlowRunLogEntry,
  type FlowRunStartPayload,
  type FlowRunState,
  type FlowRunStatusPayload,
  type RuntimeMessage,
} from '../../../shared/messages';
import type { FlowStepData } from '../../../shared/flowStepMigration';
import {
  deriveSiteKeyFromUrl,
  isRecoverableTabMessageError,
  isRecord,
  normalizeSiteKey,
  type BrowserTabChangeInfo,
} from '../runtime/pageContext';
import { TabBridge } from '../runtime/tabBridge';
import { parseDataSourceRows } from './dataSource';
import { JsTransformExecutor } from './jsTransformExecutor';
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
const NAVIGATION_TIMEOUT_MS = 20_000;
const CONDITION_POLL_INTERVAL_MS = 120;
const STATUS_THROTTLE_MS = 200;
const STEP_MESSAGE_RETRY_TIMEOUT_MS = 60_000;
const STEP_MESSAGE_RETRY_INTERVAL_MS = 250;
const MAX_RUN_LOG_ENTRIES = 500;

type FlowRunError = {
  code: string;
  message: string;
};

type FlowRunInternal = {
  runId: string;
  flow: FlowRunFlowSnapshot;
  source: FlowRunStartPayload['source'];
  tabId: number;
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
};

export class RunnerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const estimateFlowStep = (step: FlowStepData): number => {
  if (
    step.type === 'click' ||
    step.type === 'input' ||
    step.type === 'wait' ||
    step.type === 'assert' ||
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

export class FlowRunnerManager {
  private readonly runs = new Map<string, FlowRunInternal>();

  private readonly activeRunByTab = new Map<number, string>();

  private readonly runtime?: FlowRunnerManagerOptions['runtime'];

  private readonly tabBridge: TabBridge;

  private readonly statusThrottleMs: number;

  private readonly jsTransformExecutor = new JsTransformExecutor();

  constructor(options: FlowRunnerManagerOptions) {
    this.runtime = options.runtime;
    this.tabBridge = options.tabBridge;
    this.statusThrottleMs = options.statusThrottleMs ?? STATUS_THROTTLE_MS;
  }

  async start(payload: FlowRunStartPayload) {
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

    const now = Date.now();
    const runId = `run-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const run: FlowRunInternal = {
      runId,
      flow,
      source: payload.source,
      tabId,
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
  }

  private getRunByTab(tabId: number) {
    const runId = this.activeRunByTab.get(tabId);
    if (!runId) {
      return null;
    }
    return this.runs.get(runId) ?? null;
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
      return `Input "${truncateForLog(payload.value || '')}" into "${truncateForLog(payload.selector || '')}".`;
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
      const inputValue = truncateForLog(details?.inputValue ?? payload.value ?? '');
      return `Input value "${inputValue}" into ${fieldName}.`;
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
      error: run.error ? { ...run.error } : undefined,
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
      this.finalizeRun(run, 'failed', { code, message });
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
    const payload = await this.buildAtomicPayload(step, stepType, row);
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
      throw new RunnerError(result.errorCode || 'step-execution-failed', result.error || 'Step execution failed.');
    }
    this.appendLog(run, 'success', this.formatAtomicSuccessMessage(stepType, payload, result), {
      stepId: step.id,
      stepType,
    });
    this.markStepCompleted(run);
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
      throw new RunnerError(result.errorCode || 'condition-check-failed', result.error || 'Condition check failed.');
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
    const field = getStepField(step, fieldId);
    if (!field?.transform || field.transform.mode !== 'js') {
      return renderedValue;
    }
    if (field.transform.enabled === false) {
      return renderedValue;
    }
    const code = field.transform.code.trim();
    if (!code) {
      return renderedValue;
    }
    try {
      return await this.jsTransformExecutor.run({
        code,
        value: renderedValue,
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
      stepId: step.id,
      stepType,
      timeoutMs: STEP_ACTION_TIMEOUT_MS,
      pollIntervalMs: CONDITION_POLL_INTERVAL_MS,
    };

    if (stepType === 'click') {
      payload.selector = await this.resolveStepFieldValue(step, 'selector', row);
    } else if (stepType === 'input') {
      payload.selector = await this.resolveStepFieldValue(step, 'selector', row);
      payload.value = await this.resolveStepFieldValue(step, 'value', row);
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
        payload.selector = await this.resolveStepFieldValue(step, 'selector', row);
        const operator = await this.resolveStepFieldValue(step, 'operator', row);
        payload.operator =
          operator === 'equals' || operator === 'greater' || operator === 'less' ? operator : 'contains';
        payload.expected = await this.resolveStepFieldValue(step, 'expected', row);
      } else {
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

    while (true) {
      this.ensureRunHealthy(run);
      const response = await this.tabBridge.sendMessageToTabWithRetry(run.tabId, {
        type: MessageType.FLOW_RUN_EXECUTE_STEP,
        data: { ...payload, runId: run.runId },
      });
      if (response.ok) {
        if (!isRecord(response.data) || response.data.type !== MessageType.FLOW_RUN_EXECUTE_RESULT) {
          throw new RunnerError('invalid-content-response', 'Unexpected content response payload.');
        }
        const result = response.data.data;
        if (!isRecord(result) || typeof result.ok !== 'boolean') {
          throw new RunnerError('invalid-content-result', 'Malformed content execution result.');
        }
        return result as FlowRunExecuteResultPayload;
      }

      lastTransportError = response.error || 'Failed to message content script.';
      if (!isRecoverableTabMessageError(lastTransportError)) {
        throw new RunnerError('content-message-failed', lastTransportError);
      }
      if (Date.now() >= deadline) {
        throw new RunnerError(
          'content-message-timeout',
          `Timed out after ${STEP_MESSAGE_RETRY_TIMEOUT_MS}ms while waiting for page readiness: ${lastTransportError}`,
        );
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, STEP_MESSAGE_RETRY_INTERVAL_MS);
      });
    }
  }

  private async executeNavigateStep(run: FlowRunInternal, step: FlowStepData, row?: FlowRowContext) {
    const targetValue = getRenderedStepFieldValue(step, 'url', row).trim();
    if (!targetValue) {
      throw new RunnerError('navigate-url-missing', 'Navigate step URL is required.');
    }
    const tab = await this.tabBridge.getTabById(run.tabId);
    const baseUrl = run.activeUrl || tab?.url || '';
    let absoluteUrl = '';
    try {
      absoluteUrl = new URL(targetValue, baseUrl || `https://${run.siteKey}`).toString();
    } catch {
      throw new RunnerError('navigate-url-invalid', `Invalid navigate URL: ${targetValue}`);
    }
    this.appendLog(run, 'info', `Navigate to ${truncateForLog(absoluteUrl)}.`, {
      stepId: step.id,
      stepType: 'navigate',
    });
    const targetSite = deriveSiteKeyFromUrl(absoluteUrl);
    if (!targetSite || targetSite !== run.siteKey) {
      throw new RunnerError('cross-site-navigation', `Navigate target is outside site: ${absoluteUrl}`);
    }

    try {
      await this.tabBridge.updateTabUrl(run.tabId, absoluteUrl);
    } catch (error) {
      throw new RunnerError(
        'navigate-update-failed',
        error instanceof Error ? error.message : String(error),
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
      throw new RunnerError('navigate-timeout', message);
    }

    const landedUrl = completedTab.url || absoluteUrl;
    run.activeUrl = landedUrl;
    const landedSite = deriveSiteKeyFromUrl(landedUrl);
    if (!landedSite || landedSite !== run.siteKey) {
      throw new RunnerError('cross-site-navigation', `Navigation landed on another site: ${landedUrl}`);
    }
    this.appendLog(run, 'success', `Navigation completed at ${truncateForLog(landedUrl)}.`, {
      stepId: step.id,
      stepType: 'navigate',
    });
    this.ensureRunHealthy(run);
  }

  private async executeDataSourceStep(run: FlowRunInternal, step: FlowStepData, row?: FlowRowContext) {
    const children = Array.isArray(step.children) ? step.children : [];
    const parsed = parseDataSourceRows(step, estimateFlowSteps(children));
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
