import {
  MessageType,
  type FlowRunAtomicStepType,
  type FlowRunLogEntry,
  type FlowRunExecuteResultPayload,
  type FlowRunExecuteStepPayload,
  type FlowRunFlowSnapshot,
  type FlowRunStartPayload,
  type FlowRunState,
  type FlowRunStatusPayload,
  type PageContextPayload,
  type RuntimeMessage,
} from '../shared/messages';
import type { FlowStepData } from '../shared/flowStepMigration';

const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';
const STEP_ACTION_TIMEOUT_MS = 10_000;
const NAVIGATION_TIMEOUT_MS = 20_000;
const CONDITION_POLL_INTERVAL_MS = 120;
const STATUS_THROTTLE_MS = 200;
const STEP_MESSAGE_RETRY_TIMEOUT_MS = 60_000;
const STEP_MESSAGE_RETRY_INTERVAL_MS = 250;
const MAX_RUN_LOG_ENTRIES = 500;

type TabMessageResponse = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

type FlowRunError = {
  code: string;
  message: string;
};

type FlowRowContext = Record<string, string>;
type BrowserTab = {
  id?: number;
  url?: string;
  title?: string;
  status?: string;
  active?: boolean;
};
type BrowserTabChangeInfo = {
  url?: string;
  status?: string;
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

class RunnerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeSiteKey = (value: string) =>
  value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');

const deriveSiteKeyFromUrl = (url: string) => {
  if (!url) {
    return '';
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      return normalizeSiteKey((url.split(/[?#]/)[0] || url).trim());
    }
    const host = parsed.host || parsed.hostname || '';
    return normalizeSiteKey(host || url);
  } catch {
    return '';
  }
};

const derivePageContext = (url: string, tabId?: number, title?: string): PageContextPayload => {
  const timestamp = Date.now();
  const hasAccess = /^https?:\/\//.test(url) || url.startsWith('file://');
  if (!hasAccess) {
    return {
      url: url || '',
      siteKey: '',
      pageKey: '',
      tabId,
      title,
      timestamp,
      hasAccess: false,
    };
  }
  try {
    const parsed = new URL(url);
    const host = parsed.host || parsed.hostname || '';
    const siteKey = normalizeSiteKey(host || url);
    const pathname = parsed.pathname || '/';
    const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return {
      url,
      siteKey,
      pageKey: `${siteKey}${cleanPath}`,
      tabId,
      title,
      timestamp,
      hasAccess: true,
    };
  } catch {
    return {
      url: url || '',
      siteKey: '',
      pageKey: '',
      tabId,
      title,
      timestamp,
      hasAccess: false,
    };
  }
};

const isInjectableUrl = (url?: string) => {
  if (!url) {
    return false;
  }
  return /^https?:\/\//.test(url) || url.startsWith('file://');
};

const isReceivingEndMissing = (value?: string) => /receiving end does not exist/i.test(value || '');
const isMessageChannelClosed = (value?: string) =>
  /message channel is closed|message port closed|back\/forward cache/i.test(value || '');
const isRecoverableTabMessageError = (value?: string) =>
  isReceivingEndMissing(value) || isMessageChannelClosed(value);

const normalizeForwardError = (value?: string) => {
  if (isReceivingEndMissing(value)) {
    return 'content-unavailable';
  }
  if (isMessageChannelClosed(value)) {
    return 'message-channel-closed';
  }
  return value || 'unknown-error';
};

const microYield = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const getStepFieldRawValue = (step: FlowStepData, fieldId: string) =>
  step.fields.find((field) => field.id === fieldId)?.value ?? '';

const ROW_TOKEN_PATTERN = /{{\s*row(?:\.([A-Za-z0-9_$]+)|\[\s*["']([^"']+)["']\s*\])\s*}}/g;

const renderWithRowContext = (input: string, row?: FlowRowContext) => {
  if (!row || !input) {
    return input;
  }
  return input.replace(ROW_TOKEN_PATTERN, (_full, dotKey: string | undefined, bracketKey: string | undefined) => {
    const key = dotKey || bracketKey || '';
    return key in row ? row[key] : '';
  });
};

const getRenderedStepFieldValue = (step: FlowStepData, fieldId: string, row?: FlowRowContext) =>
  renderWithRowContext(getStepFieldRawValue(step, fieldId), row);

const toNonNegativeInteger = (input: string, fallback = 0) => {
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const truncateForLog = (value: string, maxLength = 120) =>
  value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}…` : value;

const parseDelimitedRows = (text: string, delimiter: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === '\r' || char === '\n') {
      if (inQuotes) {
        current += char;
        continue;
      }
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      row.push(current);
      current = '';
      rows.push(row);
      row = [];
      continue;
    }
    if (char === delimiter && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  row.push(current);
  rows.push(row);
  return rows.filter((nextRow) => nextRow.some((cell) => cell.trim() !== ''));
};

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

const parseDataSourceRows = (
  step: FlowStepData,
): {
  rows: FlowRowContext[];
  estimatedRows: number;
  rowStepWeight: number;
} => {
  const rawText = step.dataSource?.rawText || '';
  if (!rawText.trim()) {
    throw new RunnerError('data-source-empty', 'Data source has no content.');
  }
  const sourceType = step.dataSource?.fileType === 'tsv' ? 'tsv' : 'csv';
  const delimiter = sourceType === 'tsv' ? '\t' : ',';
  const table = parseDelimitedRows(rawText, delimiter);
  if (table.length === 0) {
    return { rows: [], estimatedRows: 0, rowStepWeight: estimateFlowSteps(step.children ?? []) };
  }
  const headerSetting = getStepFieldRawValue(step, 'headerRow');
  const hasHeader = headerSetting ? headerSetting === 'true' : true;
  const header = table[0];
  const columns = hasHeader
    ? header.map((value, index) => value.trim() || `column${index + 1}`)
    : header.map((_value, index) => `column${index + 1}`);
  const dataRows = hasHeader ? table.slice(1) : table;
  const rows = dataRows.map((values) => {
    const mapped: FlowRowContext = {};
    columns.forEach((column, index) => {
      mapped[column] = values[index] ?? '';
    });
    return mapped;
  });
  const estimatedRows =
    typeof step.dataSource?.rowCount === 'number' && Number.isFinite(step.dataSource.rowCount)
      ? Math.max(0, step.dataSource.rowCount)
      : rows.length;
  return { rows, estimatedRows, rowStepWeight: estimateFlowSteps(step.children ?? []) };
};

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  if (typeof chrome !== 'undefined' && chrome.sidePanel?.setPanelBehavior) {
    const result = chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    if (result && typeof result.catch === 'function') {
      result.catch((error: unknown) => {
        console.warn('Failed to enable side panel action click', error);
      });
    }
  }

  const runtime = chrome?.runtime;
  const tabsApi = chrome?.tabs;
  const scriptingApi = chrome?.scripting;

  const queryActiveTab = async () => {
    if (!tabsApi?.query) {
      return null;
    }
    return new Promise<BrowserTab | null>((resolve) => {
      tabsApi.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0] ?? null));
    });
  };

  const getTabById = async (tabId: number) => {
    if (!tabsApi?.get) {
      return null;
    }
    return new Promise<BrowserTab | null>((resolve) => {
      tabsApi.get(tabId, (tab) => {
        const error = runtime?.lastError?.message;
        if (error) {
          resolve(null);
          return;
        }
        resolve(tab ?? null);
      });
    });
  };

  const executeContentScript = async (tabId: number) => {
    if (!scriptingApi?.executeScript) {
      return false;
    }
    return new Promise<boolean>((resolve) => {
      scriptingApi.executeScript(
        {
          target: { tabId, allFrames: true },
          files: [CONTENT_SCRIPT_FILE],
        },
        () => {
          const error = runtime?.lastError?.message;
          resolve(!error);
        },
      );
    });
  };

  const sendMessageToTabRaw = async (tabId: number, message: RuntimeMessage) => {
    if (!tabsApi?.sendMessage) {
      return { response: undefined, lastError: 'Tabs API unavailable.' };
    }
    return new Promise<{ response: unknown; lastError?: string }>((resolve) => {
      tabsApi.sendMessage(tabId, message, (response) => {
        resolve({ response, lastError: runtime?.lastError?.message });
      });
    });
  };

  const sendMessageToTabWithRetry = async (
    tabId: number,
    message: RuntimeMessage,
    allowRetry = true,
  ): Promise<TabMessageResponse> => {
    const { response, lastError } = await sendMessageToTabRaw(tabId, message);
    if (lastError) {
      if (allowRetry && isRecoverableTabMessageError(lastError)) {
        const tab = await getTabById(tabId);
        if (tab && isInjectableUrl(tab.url)) {
          const injected = await executeContentScript(tabId);
          if (injected) {
            return sendMessageToTabWithRetry(tabId, message, false);
          }
        }
      }
      return { ok: false, error: normalizeForwardError(lastError) };
    }
    if (isRecord(response) && 'ok' in response) {
      const typed = response as { ok?: boolean; error?: string; data?: unknown };
      if (typed.ok === false) {
        return { ok: false, error: typed.error || 'content-handling-failed' };
      }
      return { ok: true, data: 'data' in typed ? typed.data : response };
    }
    return { ok: true, data: response };
  };

  const forwardToActiveTab = async (message: RuntimeMessage): Promise<TabMessageResponse> => {
    if (!tabsApi?.query) {
      return { ok: false, error: 'Tabs API unavailable.' };
    }
    const activeTab = await queryActiveTab();
    const tabId = activeTab?.id;
    if (!tabId) {
      return { ok: false, error: 'No active tab.' };
    }
    return sendMessageToTabWithRetry(tabId, message, true);
  };

  const broadcastPageContext = (context: PageContextPayload) => {
    runtime?.sendMessage?.({
      type: MessageType.ACTIVE_PAGE_CONTEXT,
      data: context,
      forwarded: true,
    } satisfies RuntimeMessage);
  };

  class FlowRunnerManager {
    private readonly runs = new Map<string, FlowRunInternal>();

    private readonly activeRunByTab = new Map<number, string>();

    async start(payload: FlowRunStartPayload) {
      const flow = payload.flow;
      if (!flow || !flow.id || !Array.isArray(flow.steps)) {
        throw new RunnerError('invalid-flow-payload', 'Flow payload is invalid.');
      }
      const activeTab = await queryActiveTab();
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

    onTabUpdated(tabId: number, changeInfo: BrowserTabChangeInfo, tab: BrowserTab) {
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
      if (!runtime?.sendMessage) {
        return;
      }
      const sendNow = () => {
        run.lastStatusPushAt = Date.now();
        runtime.sendMessage({
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
      if (elapsed >= STATUS_THROTTLE_MS) {
        sendNow();
        return;
      }
      if (!run.statusTimer) {
        run.statusTimer = setTimeout(() => {
          run.statusTimer = undefined;
          sendNow();
        }, Math.max(0, STATUS_THROTTLE_MS - elapsed));
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
      const payload = this.buildAtomicPayload(run, step, stepType, row);
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
      const payload = this.buildAtomicPayload(run, step, 'condition', row);
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

    private buildAtomicPayload(
      run: FlowRunInternal,
      step: FlowStepData,
      stepType: FlowRunAtomicStepType,
      row?: FlowRowContext,
    ): FlowRunExecuteStepPayload {
      const payload: FlowRunExecuteStepPayload = {
        runId: run.runId,
        stepId: step.id,
        stepType,
        timeoutMs: STEP_ACTION_TIMEOUT_MS,
        pollIntervalMs: CONDITION_POLL_INTERVAL_MS,
      };

      if (stepType === 'click') {
        payload.selector = getRenderedStepFieldValue(step, 'selector', row);
      } else if (stepType === 'input') {
        payload.selector = getRenderedStepFieldValue(step, 'selector', row);
        payload.value = getRenderedStepFieldValue(step, 'value', row);
      } else if (stepType === 'wait') {
        const modeValue = getRenderedStepFieldValue(step, 'mode', row);
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
          const durationValue = getRenderedStepFieldValue(step, 'duration', row);
          payload.durationMs = toNonNegativeInteger(durationValue, 0);
        } else if (mode === 'condition') {
          payload.selector = getRenderedStepFieldValue(step, 'selector', row);
          const operator = getRenderedStepFieldValue(step, 'operator', row);
          payload.operator =
            operator === 'equals' || operator === 'greater' || operator === 'less' ? operator : 'contains';
          payload.expected = getRenderedStepFieldValue(step, 'expected', row);
        } else {
          payload.selector = getRenderedStepFieldValue(step, 'selector', row);
        }
      } else if (stepType === 'assert' || stepType === 'condition') {
        payload.selector = getRenderedStepFieldValue(step, 'selector', row);
        const operator = getRenderedStepFieldValue(step, 'operator', row);
        payload.operator =
          operator === 'equals' || operator === 'greater' || operator === 'less' ? operator : 'contains';
        payload.expected = getRenderedStepFieldValue(step, 'expected', row);
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
        const response = await sendMessageToTabWithRetry(run.tabId, {
          type: MessageType.FLOW_RUN_EXECUTE_STEP,
          data: payload,
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
      const tab = await getTabById(run.tabId);
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
      if (!tabsApi?.update) {
        throw new RunnerError('tabs-api-unavailable', 'Tabs API unavailable.');
      }
      await new Promise<void>((resolve, reject) => {
        tabsApi.update(run.tabId, { url: absoluteUrl }, () => {
          const error = runtime?.lastError?.message;
          if (error) {
            reject(new RunnerError('navigate-update-failed', error));
            return;
          }
          resolve();
        });
      });
      const completedTab = await this.waitForTabComplete(run.tabId, NAVIGATION_TIMEOUT_MS);
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

    private waitForTabComplete(tabId: number, timeoutMs: number) {
      if (!tabsApi?.onUpdated || !tabsApi?.get) {
        throw new RunnerError('tabs-api-unavailable', 'Tabs API unavailable.');
      }
      return new Promise<BrowserTab>((resolve, reject) => {
        let finished = false;
        const done = (callback: () => void) => {
          if (finished) {
            return;
          }
          finished = true;
          clearTimeout(timeout);
          tabsApi.onUpdated.removeListener(handleUpdated);
          callback();
        };
        const handleUpdated = (
          updatedTabId: number,
          changeInfo: BrowserTabChangeInfo,
          tab: BrowserTab,
        ) => {
          if (updatedTabId !== tabId) {
            return;
          }
          if (changeInfo.url) {
            const run = this.getRunByTab(tabId);
            if (run) {
              this.updateRunActiveUrl(run, changeInfo.url);
            }
          }
          if (changeInfo.status === 'complete') {
            done(() => resolve(tab));
          }
        };
        const timeout = setTimeout(() => {
          done(() => reject(new RunnerError('navigate-timeout', 'Timed out waiting for page load completion.')));
        }, timeoutMs);

        tabsApi.onUpdated.addListener(handleUpdated);
        tabsApi.get(tabId, (tab) => {
          const error = runtime?.lastError?.message;
          if (error) {
            done(() => reject(new RunnerError('navigate-tab-missing', error)));
            return;
          }
          if (tab?.status === 'complete') {
            done(() => resolve(tab));
          }
        });
      });
    }

    private async executeDataSourceStep(run: FlowRunInternal, step: FlowStepData, row?: FlowRowContext) {
      const children = Array.isArray(step.children) ? step.children : [];
      const parsed = parseDataSourceRows(step);
      this.appendLog(
        run,
        'info',
        `Data source rows: ${parsed.rows.length}.`,
        { stepId: step.id, stepType: 'data-source' },
      );
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

  const flowRunnerManager = new FlowRunnerManager();

  if (!runtime?.onMessage) {
    return;
  }

  runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const message = rawMessage as RuntimeMessage | undefined;
    if (!message?.type || message.forwarded) {
      return;
    }

    const respondPromise = async (task: () => Promise<TabMessageResponse>) => {
      try {
        const result = await task();
        sendResponse?.(result);
      } catch (error) {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    switch (message.type) {
      case MessageType.START_PICKER:
      case MessageType.CANCEL_PICKER:
      case MessageType.CREATE_ELEMENT:
      case MessageType.UPDATE_ELEMENT:
      case MessageType.DELETE_ELEMENT:
      case MessageType.PREVIEW_ELEMENT:
      case MessageType.FOCUS_ELEMENT:
      case MessageType.SET_EDITING_ELEMENT:
      case MessageType.REHYDRATE_ELEMENTS: {
        void respondPromise(() => forwardToActiveTab(message));
        return true;
      }
      case MessageType.PICKER_RESULT:
      case MessageType.PICKER_CANCELLED:
      case MessageType.PICKER_INVALID:
      case MessageType.ELEMENT_DRAFT_UPDATED: {
        runtime.sendMessage({ ...message, forwarded: true });
        sendResponse?.({ ok: true });
        return true;
      }
      case MessageType.GET_ACTIVE_PAGE_CONTEXT: {
        void respondPromise(async () => {
          const tab = await queryActiveTab();
          const context = derivePageContext(tab?.url || '', tab?.id, tab?.title);
          return { ok: true, data: context };
        });
        return true;
      }
      case MessageType.PAGE_CONTEXT_PING: {
        const frameId = typeof sender?.frameId === 'number' ? sender.frameId : 0;
        if (frameId === 0 && typeof sender?.tab?.id === 'number') {
          const url = sender.tab.url || message.data?.url || '';
          flowRunnerManager.onPageContextPing(sender.tab.id, url);
        }
        if (frameId !== 0 || sender?.tab?.active === false) {
          sendResponse?.({ ok: true });
          return true;
        }
        const context = derivePageContext(
          sender?.tab?.url || message.data?.url || '',
          sender?.tab?.id,
          sender?.tab?.title,
        );
        broadcastPageContext(context);
        sendResponse?.({ ok: true });
        return true;
      }
      case MessageType.START_FLOW_RUN: {
        void respondPromise(async () => {
          const result = await flowRunnerManager.start(message.data);
          return { ok: true, data: result };
        });
        return true;
      }
      case MessageType.STOP_FLOW_RUN: {
        void respondPromise(async () => {
          const result = flowRunnerManager.stop(message.data.runId);
          return { ok: true, data: result };
        });
        return true;
      }
      default:
        return;
    }
  });

  if (tabsApi?.onUpdated) {
    tabsApi.onUpdated.addListener((tabId, changeInfo, tab) => {
      flowRunnerManager.onTabUpdated(tabId, changeInfo, tab);
      if (!tab.active) {
        return;
      }
      if (!changeInfo.url && changeInfo.status !== 'complete') {
        return;
      }
      const url = changeInfo.url || tab.url;
      if (!url) {
        return;
      }
      const context = derivePageContext(url, tabId, tab.title);
      broadcastPageContext(context);
    });
  }

  if (tabsApi?.onActivated) {
    tabsApi.onActivated.addListener(() => {
      void (async () => {
        const tab = await queryActiveTab();
        const context = derivePageContext(tab?.url || '', tab?.id, tab?.title);
        broadcastPageContext(context);
      })();
    });
  }
});
