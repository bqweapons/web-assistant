import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, Play, Search, Square, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import FlowDrawer from '../components/FlowDrawer';
import FlowStepsBuilder, { type StepData as FlowStepData } from '../components/FlowStepsBuilder';
import { t } from '../utils/i18n';
import {
  MessageType,
  type FlowRunFlowSnapshot,
  type FlowRunStartSource,
  type FlowRunStatusPayload,
  type RuntimeMessage,
  type SelectorPickerAccept,
} from '../../../shared/messages';
import { getSiteData, setSiteData, STORAGE_KEY } from '../../../shared/storage';
import { deriveSiteKey, type StructuredFlowRecord } from '../../../shared/siteDataSchema';
import { normalizeFlowSteps } from '../../../shared/flowStepMigration';

type FlowRecord = StructuredFlowRecord & {
  scope: 'page' | 'site' | 'global';
  siteKey: string;
  pageKey: string | null;
  steps: FlowStepData[];
  updatedAt: number;
};

type FlowsSectionProps = {
  siteKey?: string;
  hasActivePage?: boolean;
  createFlowOpen?: boolean;
  onCreateFlowClose?: () => void;
  onStartPicker?: (accept: SelectorPickerAccept) => Promise<string | null>;
};

type FlowSummaryActions = {
  onSave: () => void;
  onSaveRun?: () => void;
  onRun?: () => void;
  disableSave?: boolean;
  disableSaveRun?: boolean;
  disableRun?: boolean;
};

const formatTimestamp = (value: number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (segment: number) => String(segment).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const getStepCount = (value: FlowStepData[]) => value.length;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
};

const normalizeFlow = (value: unknown, fallbackSiteKey: string): FlowRecord | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : '';
  if (!id) {
    return null;
  }
  const resolvedSiteKey =
    deriveSiteKey(typeof value.siteKey === 'string' ? value.siteKey : '') || fallbackSiteKey;
  if (!resolvedSiteKey) {
    return null;
  }
  const normalizedSteps = normalizeFlowSteps(value.steps, {
    flowId: id,
    keepNumber: false,
    sanitizeExisting: true,
  });
  return {
    id,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : t('sidepanel_flows_new_default', 'New flow'),
    description: typeof value.description === 'string' ? value.description : '',
    scope: value.scope === 'page' || value.scope === 'global' ? value.scope : 'site',
    siteKey: resolvedSiteKey,
    pageKey: typeof value.pageKey === 'string' ? value.pageKey : null,
    steps: Array.isArray(normalizedSteps) ? (normalizedSteps as FlowStepData[]) : [],
    updatedAt: toTimestamp(value.updatedAt),
  };
};

const toFlowSnapshot = (flow: FlowRecord): FlowRunFlowSnapshot => ({
  id: flow.id,
  name: flow.name,
  description: flow.description,
  scope: flow.scope,
  siteKey: flow.siteKey,
  pageKey: flow.pageKey,
  steps: flow.steps,
  updatedAt: flow.updatedAt,
});

const getRunnerStateLabel = (state?: FlowRunStatusPayload['state']) => {
  if (state === 'running') {
    return t('sidepanel_flow_runner_state_running', 'Running');
  }
  if (state === 'queued') {
    return t('sidepanel_flow_runner_state_queued', 'Queued');
  }
  if (state === 'succeeded') {
    return t('sidepanel_flow_runner_state_succeeded', 'Succeeded');
  }
  if (state === 'failed') {
    return t('sidepanel_flow_runner_state_failed', 'Failed');
  }
  if (state === 'cancelled') {
    return t('sidepanel_flow_runner_state_cancelled', 'Cancelled');
  }
  return t('sidepanel_label_unknown', 'Unknown');
};

const formatRunnerError = (code?: string, message?: string) => {
  if (!code && !message) {
    return '';
  }
  if (code === 'site-mismatch' || code === 'cross-site-navigation') {
    return t('sidepanel_flow_runner_error_site_mismatch', 'Flow can only run on the same site.');
  }
  if (code === 'runner-busy') {
    return t('sidepanel_flow_runner_error_busy', 'Another flow is already running.');
  }
  if (code === 'unsupported-step-type') {
    return t('sidepanel_flow_runner_error_unsupported_step', 'Flow has an unsupported step type.');
  }
  return message || code || t('sidepanel_flow_runner_error_unknown', 'Flow run failed.');
};

export default function FlowsSection({
  siteKey = '',
  hasActivePage = false,
  createFlowOpen = false,
  onCreateFlowClose,
  onStartPicker,
}: FlowsSectionProps) {
  const normalizedSiteKey = useMemo(() => deriveSiteKey(siteKey), [siteKey]);

  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('recent');
  const actionClass = 'btn-icon h-8 w-8';
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [editFlow, setEditFlow] = useState<FlowRecord | null>(null);
  const [editResetKey, setEditResetKey] = useState(0);
  const [draftFlow, setDraftFlow] = useState({
    name: '',
    description: '',
    steps: [] as FlowStepData[],
  });
  const [createResetKey, setCreateResetKey] = useState(0);
  const [runStatus, setRunStatus] = useState<FlowRunStatusPayload | null>(null);
  const [runRequestError, setRunRequestError] = useState('');
  const [runLogCopyFeedback, setRunLogCopyFeedback] = useState('');
  const runLogScrollRef = useRef<HTMLDivElement | null>(null);

  const sendRuntimeMessage = useCallback((message: RuntimeMessage) => {
    return new Promise<unknown>((resolve, reject) => {
      const runtime = chrome?.runtime;
      if (!runtime?.sendMessage) {
        reject(new Error('Messaging API unavailable.'));
        return;
      }
      runtime.sendMessage(message, (response) => {
        const lastError = runtime.lastError?.message;
        if (lastError) {
          reject(new Error(lastError));
          return;
        }
        if (response?.ok === false) {
          reject(new Error(response.error || 'Messaging failed.'));
          return;
        }
        resolve(response?.data);
      });
    });
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFlows = useMemo(() => {
    return flows.filter((flow) => {
      if (normalizedSiteKey && flow.siteKey !== normalizedSiteKey) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = `${flow.name} ${flow.description} ${flow.siteKey}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [flows, normalizedQuery, normalizedSiteKey]);

  const visibleFlows = useMemo(() => {
    const items = [...filteredFlows];
    if (sortMode === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name));
      return items;
    }
    if (sortMode === 'steps') {
      items.sort((a, b) => getStepCount(b.steps) - getStepCount(a.steps));
      return items;
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return items;
  }, [filteredFlows, sortMode]);

  const showClear = Boolean(normalizedQuery) || sortMode !== 'recent';

  const isRunActive = runStatus?.state === 'queued' || runStatus?.state === 'running';
  const runErrorMessage = useMemo(() => {
    if (runRequestError) {
      return runRequestError;
    }
    if (!runStatus?.error) {
      return '';
    }
    return formatRunnerError(runStatus.error.code, runStatus.error.message);
  }, [runRequestError, runStatus?.error]);

  const currentRunFlow = useMemo(
    () => (runStatus?.flowId ? flows.find((flow) => flow.id === runStatus.flowId) ?? null : null),
    [flows, runStatus?.flowId],
  );
  const runLogs = runStatus?.logs ?? [];
  const lastRunLogId = runLogs.length ? runLogs[runLogs.length - 1]?.id : '';

  useEffect(() => {
    if (createFlowOpen) {
      setActiveFlowId(null);
      setEditFlow(null);
      setEditResetKey((prev) => prev + 1);
      setCreateResetKey((prev) => prev + 1);
      setDraftFlow({ name: '', description: '', steps: [] });
    }
  }, [createFlowOpen]);

  useEffect(() => {
    setActiveFlowId(null);
    setEditFlow(null);
    setEditResetKey((prev) => prev + 1);
    setDraftFlow({ name: '', description: '', steps: [] });
    setCreateResetKey((prev) => prev + 1);
  }, [normalizedSiteKey]);

  useEffect(() => {
    const runtime = chrome?.runtime;
    if (!runtime?.onMessage) {
      return;
    }
    const handleRuntimeMessage = (rawMessage: RuntimeMessage) => {
      if (!rawMessage?.forwarded || rawMessage.type !== MessageType.FLOW_RUN_STATUS) {
        return;
      }
      setRunStatus(rawMessage.data);
      if (rawMessage.data.state !== 'failed') {
        setRunRequestError('');
      }
    };
    runtime.onMessage.addListener(handleRuntimeMessage);
    return () => runtime.onMessage.removeListener(handleRuntimeMessage);
  }, []);

  const loadFlows = useCallback(() => {
    if (!normalizedSiteKey) {
      setFlows([]);
      return;
    }
    getSiteData(normalizedSiteKey)
      .then((data) => {
        const next = (Array.isArray(data.flows) ? data.flows : [])
          .map((item) => normalizeFlow(item, normalizedSiteKey))
          .filter((item): item is FlowRecord => Boolean(item));
        setFlows(next);
      })
      .catch(() => setFlows([]));
  }, [normalizedSiteKey]);

  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  useEffect(() => {
    const storage = chrome?.storage?.onChanged;
    if (!storage || !normalizedSiteKey) {
      return;
    }
    const handleStorageChange = (changes: Record<string, unknown>, areaName: string) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY]) {
        return;
      }
      loadFlows();
    };
    storage.addListener(handleStorageChange);
    return () => storage.removeListener(handleStorageChange);
  }, [loadFlows, normalizedSiteKey]);

  const persistFlows = useCallback(
    (nextFlows: FlowRecord[]) => {
      if (!normalizedSiteKey) {
        return;
      }
      setSiteData(normalizedSiteKey, { flows: nextFlows }).catch(() => undefined);
    },
    [normalizedSiteKey],
  );

  const openFlowEditor = useCallback(
    (flowId: string) => {
      const selected = flows.find((flow) => flow.id === flowId);
      if (!selected) {
        return;
      }
      setActiveFlowId(flowId);
      setEditFlow({
        ...selected,
        description: selected.description || '',
      });
      setEditResetKey((prev) => prev + 1);
    },
    [flows],
  );

  const closeEditDrawer = useCallback(() => {
    setActiveFlowId(null);
    setEditFlow(null);
  }, []);

  const closeCreateDrawer = useCallback(() => {
    onCreateFlowClose?.();
  }, [onCreateFlowClose]);

  const startFlowRun = useCallback(
    async (flow: FlowRecord, source: FlowRunStartSource) => {
      setRunRequestError('');
      const startedAt = Date.now();
      try {
        const response = await sendRuntimeMessage({
          type: MessageType.START_FLOW_RUN,
          data: {
            flow: toFlowSnapshot(flow),
            source,
          },
        });
        const runId = isRecord(response) && typeof response.runId === 'string' ? response.runId : `run-${startedAt}`;
        setRunStatus((prev) => ({
          runId,
          flowId: flow.id,
          siteKey: flow.siteKey,
          tabId: prev?.tabId ?? 0,
          state: 'queued',
          progress: { completedSteps: 0, totalSteps: Math.max(1, flow.steps.length) },
          startedAt,
          activeUrl: prev?.activeUrl || '',
          currentStepId: prev?.currentStepId,
          endedAt: undefined,
          error: undefined,
          logs: [],
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setRunRequestError(formatRunnerError(message, message));
      }
    },
    [sendRuntimeMessage],
  );

  const formatLogTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '--:--:--';
    }
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, []);

  const copyRunLogs = useCallback(async () => {
    if (!runLogs.length) {
      setRunLogCopyFeedback(t('sidepanel_flow_runner_logs_empty', 'No logs to copy.'));
      return;
    }
    const output = runLogs
      .map((entry) => `[${formatLogTime(entry.timestamp)}] ${entry.level.toUpperCase()} ${entry.message}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(output);
      setRunLogCopyFeedback(t('sidepanel_flow_runner_logs_copied', 'Logs copied.'));
    } catch {
      setRunLogCopyFeedback(t('sidepanel_flow_runner_logs_copy_failed', 'Failed to copy logs.'));
    }
  }, [formatLogTime, runLogs]);

  useEffect(() => {
    if (!lastRunLogId) {
      return;
    }
    const container = runLogScrollRef.current;
    if (!container) {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [lastRunLogId]);

  const stopFlowRun = useCallback(async () => {
    if (!runStatus?.runId) {
      return;
    }
    setRunRequestError('');
    try {
      await sendRuntimeMessage({
        type: MessageType.STOP_FLOW_RUN,
        data: { runId: runStatus.runId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunRequestError(formatRunnerError(message, message));
    }
  }, [runStatus?.runId, sendRuntimeMessage]);

  const saveEditedFlow = useCallback(
    (closeDrawer = true): FlowRecord | null => {
      if (!editFlow) {
        return null;
      }
      const updatedAt = Date.now();
      const nextFlow: FlowRecord = {
        ...editFlow,
        name: editFlow.name.trim() || t('sidepanel_flows_new_default', 'New flow'),
        description: editFlow.description.trim(),
        updatedAt,
      };
      setFlows((prev) => {
        const exists = prev.some((item) => item.id === nextFlow.id);
        const next = exists
          ? prev.map((item) => (item.id === nextFlow.id ? nextFlow : item))
          : [...prev, nextFlow];
        persistFlows(next);
        return next;
      });
      setEditFlow(nextFlow);
      if (closeDrawer) {
        closeEditDrawer();
      }
      return nextFlow;
    },
    [closeEditDrawer, editFlow, persistFlows],
  );

  const createDraftFlow = useCallback((): FlowRecord | null => {
    if (!normalizedSiteKey) {
      return null;
    }
    const name = draftFlow.name.trim() || t('sidepanel_flows_new_default', 'New flow');
    const description = draftFlow.description.trim();
    const nextFlow: FlowRecord = {
      id: `flow-${Date.now()}`,
      name,
      description,
      scope: 'site',
      siteKey: normalizedSiteKey,
      pageKey: null,
      steps: draftFlow.steps,
      updatedAt: Date.now(),
    };
    setFlows((prev) => {
      const next = [...prev, nextFlow];
      persistFlows(next);
      return next;
    });
    closeCreateDrawer();
    return nextFlow;
  }, [closeCreateDrawer, draftFlow.description, draftFlow.name, draftFlow.steps, normalizedSiteKey, persistFlows]);

  const handleFlowSave = () => {
    saveEditedFlow(true);
  };

  const handleFlowSaveRun = () => {
    const saved = saveEditedFlow(false);
    if (!saved) {
      return;
    }
    void startFlowRun(saved, 'flow-drawer-save-run');
  };

  const handleCreateFlow = () => {
    createDraftFlow();
  };

  const handleCreateFlowSaveRun = () => {
    const created = createDraftFlow();
    if (!created) {
      return;
    }
    void startFlowRun(created, 'flow-drawer-save-run');
  };

  const renderSummary = (steps: number, actions: FlowSummaryActions) => (
    <>
      <p className="text-xs font-semibold text-muted-foreground">
        {t('sidepanel_flows_summary_title', 'Summary')}
      </p>
      <p className="text-sm text-foreground">
        {t('sidepanel_steps_count', '{count} steps').replace('{count}', String(steps))}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          onClick={actions.onSave}
          disabled={actions.disableSave}
        >
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            {t('sidepanel_action_save', 'Save')}
          </span>
        </button>
        <button
          type="button"
          className="btn-ghost h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          onClick={actions.onSaveRun}
          disabled={actions.disableSaveRun || !actions.onSaveRun}
        >
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('sidepanel_action_save_run', 'Save & Run')}
          </span>
        </button>
        <button
          type="button"
          className="btn-ghost h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          onClick={actions.onRun}
          disabled={actions.disableRun || !actions.onRun}
        >
          <span className="inline-flex items-center gap-1">
            <Play className="h-3.5 w-3.5" />
            {t('sidepanel_action_run', 'Run')}
          </span>
        </button>
      </div>
    </>
  );

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-card-foreground">
            {t('sidepanel_flows_title', 'Action flows')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('sidepanel_flows_subtitle', 'Build reusable action sequences.')}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{visibleFlows.length}</span>
      </div>

      {(runStatus || runErrorMessage) && (
        <Card className="border border-border/70 bg-muted/50">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t('sidepanel_flow_runner_status_title', 'Runner status')}
                </p>
                <p className="text-sm font-semibold text-card-foreground">{getRunnerStateLabel(runStatus?.state)}</p>
                {currentRunFlow?.name ? (
                  <p className="truncate text-xs text-muted-foreground">{currentRunFlow.name}</p>
                ) : null}
                {runStatus ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t('sidepanel_flow_runner_progress', '{done}/{total} steps')
                      .replace('{done}', String(runStatus.progress.completedSteps))
                      .replace('{total}', String(runStatus.progress.totalSteps))}
                  </p>
                ) : null}
                {runStatus?.currentStepId ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t('sidepanel_flow_runner_current_step', 'Current step: {step}').replace(
                      '{step}',
                      runStatus.currentStepId,
                    )}
                  </p>
                ) : null}
                {runErrorMessage ? <p className="text-[11px] text-destructive">{runErrorMessage}</p> : null}
              </div>
              {isRunActive && runStatus?.runId ? (
                <button type="button" className="btn-ghost h-8 px-3 text-xs" onClick={stopFlowRun}>
                  <span className="inline-flex items-center gap-1">
                    <Square className="h-3.5 w-3.5" />
                    {t('sidepanel_flow_runner_stop', 'Stop')}
                  </span>
                </button>
              ) : null}
            </div>

            <div className="rounded-lg border border-border bg-card/70 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {t('sidepanel_flow_runner_logs_title', 'Execution logs')}
                </p>
                <button
                  type="button"
                  className="btn-icon h-7 w-7"
                  onClick={() => void copyRunLogs()}
                  aria-label={t('sidepanel_flow_runner_logs_copy', 'Copy logs')}
                  title={t('sidepanel_flow_runner_logs_copy', 'Copy logs')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              {runLogCopyFeedback ? (
                <p className="mt-1 text-[10px] text-muted-foreground">{runLogCopyFeedback}</p>
              ) : null}
              <div ref={runLogScrollRef} className="mt-2 max-h-40 overflow-y-auto pr-1">
                {runLogs.length ? (
                  <div className="space-y-1">
                    {runLogs.map((entry) => (
                      <p
                        key={entry.id}
                        className={`flex items-start gap-2 text-[11px] ${
                          entry.level === 'error'
                            ? 'text-destructive'
                            : entry.level === 'success'
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                        }`}
                      >
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {formatLogTime(entry.timestamp)}
                        </span>
                        <span className="min-w-0 break-all">{entry.message}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {t('sidepanel_flow_runner_logs_empty', 'No logs yet.')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input pl-9"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('sidepanel_flows_search_placeholder', 'Search flows')}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input select w-full sm:w-40"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="recent">{t('sidepanel_flows_sort_recent', 'Recently updated')}</option>
            <option value="name">{t('sidepanel_flows_sort_name', 'Name')}</option>
            <option value="steps">{t('sidepanel_flows_sort_steps', 'Steps')}</option>
          </select>
          {showClear ? (
            <button
              type="button"
              className="btn-ghost px-3"
              onClick={() => {
                setSearchQuery('');
                setSortMode('recent');
              }}
            >
              {t('sidepanel_action_clear', 'Clear')}
            </button>
          ) : null}
        </div>
      </div>

      {!hasActivePage ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t(
            'sidepanel_elements_no_active_page',
            'No active page detected. Open a site tab and refresh to manage elements.',
          )}
        </Card>
      ) : flows.length === 0 ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t('sidepanel_flows_empty', 'No flows yet. Create one to define automated actions.')}
        </Card>
      ) : visibleFlows.length === 0 ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t('sidepanel_flows_empty_filtered', 'No matches. Try a different search or filter.')}
        </Card>
      ) : (
        <div className="grid gap-2">
          {visibleFlows.map((flow) => (
            <Card key={flow.id} onClick={() => openFlowEditor(flow.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="badge-pill shrink-0">{t('sidepanel_flows_badge', 'Flow')}</span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-card-foreground">{flow.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {flow.description || t('sidepanel_flows_no_description', 'No description')}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={actionClass}
                    aria-label={t('sidepanel_flows_run', 'Run flow')}
                    title={t('sidepanel_flows_run', 'Run flow')}
                    onClick={(event) => {
                      event.stopPropagation();
                      void startFlowRun(flow, 'flows-list');
                    }}
                    disabled={!hasActivePage || isRunActive}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`${actionClass} btn-icon-danger`}
                    aria-label={t('sidepanel_flows_delete', 'Delete flow')}
                    title={t('sidepanel_flows_delete', 'Delete flow')}
                    onClick={(event) => {
                      event.stopPropagation();
                      setFlows((prev) => {
                        const next = prev.filter((item) => item.id !== flow.id);
                        persistFlows(next);
                        return next;
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="badge-pill">
                  {t('sidepanel_steps_count', '{count} steps').replace('{count}', String(getStepCount(flow.steps)))}
                </span>
                <span className="truncate">{formatTimestamp(flow.updatedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FlowDrawer
        open={Boolean(editFlow)}
        title={editFlow?.name ?? t('sidepanel_flows_detail_title', 'Flow details')}
        subtitle={t('sidepanel_flows_detail_subtitle', 'Edit the flow settings below.')}
        onClose={closeEditDrawer}
        summary={renderSummary(getStepCount(editFlow?.steps || []), {
          onSave: handleFlowSave,
          onSaveRun: handleFlowSaveRun,
          onRun: editFlow
            ? () => {
                void startFlowRun(editFlow, 'flows-list');
              }
            : undefined,
          disableSave: false,
          disableSaveRun: !hasActivePage || isRunActive,
          disableRun: !hasActivePage || isRunActive || !editFlow,
        })}
      >
        {editFlow ? (
          <div className="space-y-4 text-xs text-muted-foreground">
            <label className="block text-xs font-semibold text-muted-foreground">
              {t('sidepanel_field_name', 'Name')}
              <input
                className="input mt-1"
                value={editFlow.name}
                onChange={(event) => setEditFlow({ ...editFlow, name: event.target.value })}
                placeholder={t('sidepanel_flows_name_placeholder', 'Flow name')}
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              {t('sidepanel_field_description', 'Description')}
              <textarea
                className="input mt-1"
                rows={2}
                value={editFlow.description}
                onChange={(event) => setEditFlow({ ...editFlow, description: event.target.value })}
                placeholder={t('sidepanel_flows_description_placeholder', 'Describe what the flow does')}
              />
            </label>
            <FlowStepsBuilder
              steps={editFlow.steps}
              resetKey={`edit:${editResetKey}:${activeFlowId || 'none'}`}
              onChange={(steps) => {
                setEditFlow((prev) => (prev ? { ...prev, steps } : prev));
              }}
              onStartPicker={onStartPicker}
            />
          </div>
        ) : null}
      </FlowDrawer>

      <FlowDrawer
        open={createFlowOpen}
        title={t('sidepanel_flows_new_title', 'New flow')}
        subtitle={t('sidepanel_flows_new_subtitle', 'Create a new action flow.')}
        onClose={closeCreateDrawer}
        summary={renderSummary(getStepCount(draftFlow.steps), {
          onSave: handleCreateFlow,
          onSaveRun: handleCreateFlowSaveRun,
          disableSaveRun: !hasActivePage || isRunActive,
          disableRun: true,
        })}
      >
        <div className="space-y-4 text-xs text-muted-foreground">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t('sidepanel_field_name', 'Name')}
            <input
              className="input mt-1"
              value={draftFlow.name}
              onChange={(event) => setDraftFlow({ ...draftFlow, name: event.target.value })}
              placeholder={t('sidepanel_flows_name_placeholder', 'Flow name')}
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            {t('sidepanel_field_description', 'Description')}
            <textarea
              className="input mt-1"
              rows={2}
              value={draftFlow.description}
              onChange={(event) => setDraftFlow({ ...draftFlow, description: event.target.value })}
              placeholder={t('sidepanel_flows_description_placeholder', 'Describe what the flow does')}
            />
          </label>
          <FlowStepsBuilder
            steps={draftFlow.steps}
            resetKey={`create:${createResetKey}:${normalizedSiteKey}`}
            onChange={(steps) => {
              setDraftFlow((prev) => ({ ...prev, steps }));
            }}
            onStartPicker={onStartPicker}
          />
        </div>
      </FlowDrawer>
    </section>
  );
}
