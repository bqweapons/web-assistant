import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Copy, Play, Search, Square, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import FlowDrawer from '../components/FlowDrawer';
import FlowStepsBuilder from '../components/FlowStepsBuilder';
import { t } from '../utils/i18n';
import {
  type SelectorPickerAccept,
} from '../../../shared/messages';
import { getSiteData, setSiteData, STORAGE_KEY } from '../../../shared/storage';
import { deriveSiteKey } from '../../../shared/siteDataSchema';
import type { FlowStepData } from '../../../shared/flowStepMigration';
import { isSecretTokenValue } from '../../../shared/secrets';
import { formatTimestamp, getStepCount, normalizeFlow, type FlowRecord } from './flows/normalize';
import { getRunnerStateLabel, useFlowRunner } from './flows/useFlowRunner';
import { getStepFieldStringValue, isPasswordLikeSelector } from '../components/flowSteps/secretInputUtils';

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
  saveRunDisabledReason?: string;
  runDisabledReason?: string;
};

const getEditableSnapshot = (flow: Pick<FlowRecord, 'name' | 'description' | 'steps'>) =>
  JSON.stringify({
    name: flow.name,
    description: flow.description,
    steps: flow.steps,
  });

const hasLiteralPasswordInputStep = (steps: FlowStepData[]): boolean => {
  for (const step of steps) {
    if (step.type === 'input') {
      const selector = getStepFieldStringValue(step, 'selector');
      const value = getStepFieldStringValue(step, 'value');
      if (isPasswordLikeSelector(selector) && value.trim() && !isSecretTokenValue(value)) {
        return true;
      }
    }
    if (Array.isArray(step.children) && hasLiteralPasswordInputStep(step.children)) {
      return true;
    }
    if (Array.isArray(step.branches)) {
      for (const branch of step.branches) {
        if (Array.isArray(branch.steps) && hasLiteralPasswordInputStep(branch.steps)) {
          return true;
        }
      }
    }
  }
  return false;
};

const validateNoLiteralPasswordsInFlow = (flow: Pick<FlowRecord, 'steps'>): string | null => {
  if (!hasLiteralPasswordInputStep(flow.steps || [])) {
    return null;
  }
  return t(
    'sidepanel_flows_validation_password_secret_required',
    'Detected a password field using plain text input. Save it to the password vault and bind it before saving or running.',
  );
};

const findStepById = (steps: FlowStepData[], stepId?: string): FlowStepData | null => {
  if (!stepId) {
    return null;
  }
  for (const step of steps) {
    if (step.id === stepId) {
      return step;
    }
    if (Array.isArray(step.children) && step.children.length > 0) {
      const found = findStepById(step.children, stepId);
      if (found) {
        return found;
      }
    }
    if (Array.isArray(step.branches) && step.branches.length > 0) {
      for (const branch of step.branches) {
        const found = findStepById(branch.steps ?? [], stepId);
        if (found) {
          return found;
        }
      }
    }
  }
  return null;
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
  const [editFlowSnapshot, setEditFlowSnapshot] = useState('');
  const [editResetKey, setEditResetKey] = useState(0);
  const [flowActionError, setFlowActionError] = useState('');
  const [flowLoadError, setFlowLoadError] = useState('');
  const [pendingDeleteFlowId, setPendingDeleteFlowId] = useState<string | null>(null);
  const [pendingDiscardEdit, setPendingDiscardEdit] = useState(false);
  const [draftFlow, setDraftFlow] = useState({
    name: '',
    description: '',
    steps: [] as FlowStepData[],
  });
  const [createResetKey, setCreateResetKey] = useState(0);
  const [runLogsExpanded, setRunLogsExpanded] = useState(false);
  const {
    runStatus,
    runErrorMessage,
    runLogCopyFeedback,
    runLogScrollRef,
    runLogs,
    isRunActive,
    currentRunFlow,
    startFlowRun,
    stopFlowRun,
    copyRunLogs,
    formatLogTime,
  } = useFlowRunner(flows);

  const currentRunStep = useMemo(
    () => findStepById(currentRunFlow?.steps ?? [], runStatus?.currentStepId),
    [currentRunFlow, runStatus?.currentStepId],
  );
  const visibleRunLogs = useMemo(
    () => (runLogsExpanded ? runLogs : runLogs.slice(-5)),
    [runLogs, runLogsExpanded],
  );
  const hasMoreRunLogs = runLogs.length > 5;

  useEffect(() => {
    setRunLogsExpanded(false);
  }, [runStatus?.runId]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const runDisabledReason = !hasActivePage
    ? t('sidepanel_flows_disabled_no_active_page', 'No active page. Running is disabled.')
    : isRunActive
      ? t('sidepanel_flows_disabled_runner_busy', 'Another flow is running.')
      : '';
  const isEditDirty = editFlow ? getEditableSnapshot(editFlow) !== editFlowSnapshot : false;
  const getStepTypeLabel = useCallback((type?: FlowStepData['type']) => {
    switch (type) {
      case 'click':
        return t('sidepanel_step_click_label', 'Click');
      case 'input':
        return t('sidepanel_step_input_label', 'Input');
      case 'wait':
        return t('sidepanel_step_wait_label', 'Wait');
      case 'assert':
        return t('sidepanel_step_assert_label', 'Assert');
      case 'condition':
        return t('sidepanel_step_condition_label', 'Condition');
      case 'popup':
        return t('sidepanel_step_popup_label', 'Popup');
      case 'navigate':
        return t('sidepanel_step_navigate_label', 'Navigate');
      case 'loop':
        return t('sidepanel_step_loop_label', 'Loop');
      case 'if-else':
        return t('sidepanel_step_if_else_label', 'If / Else');
      case 'data-source':
        return t('sidepanel_step_data_source_label', 'Data source');
      default:
        return t('sidepanel_label_unknown', 'Unknown');
    }
  }, []);
  const currentStepDetailMessage = useMemo(() => {
    if (!runStatus) {
      return '';
    }
    if (runStatus.state === 'queued') {
      return t('sidepanel_flow_runner_current_step_waiting_start', 'Waiting to start the flow...');
    }
    if (runStatus.state !== 'running') {
      if (runErrorMessage) {
        return runErrorMessage;
      }
      return t('sidepanel_flow_runner_current_step_idle', 'No step is currently running.');
    }
    if (!currentRunStep) {
      return t('sidepanel_flow_runner_current_step_preparing', 'Preparing the next step...');
    }
    if (currentRunStep.type === 'popup') {
      return t(
        'sidepanel_flow_runner_current_step_popup_waiting',
        'Waiting for confirmation in the page popup (click OK to continue).',
      );
    }
    if (currentRunStep.type === 'wait') {
      const mode = getStepFieldStringValue(currentRunStep, 'mode');
      if (mode === 'time') {
        const duration = getStepFieldStringValue(currentRunStep, 'duration');
        return t('sidepanel_flow_runner_current_step_wait_time', 'Waiting for {value} ms...').replace(
          '{value}',
          duration || '0',
        );
      }
      return t('sidepanel_flow_runner_current_step_wait_condition', 'Waiting for the page condition...');
    }
    return t('sidepanel_flow_runner_current_step_running_generic', 'Running the current step...');
  }, [currentRunStep, runErrorMessage, runStatus]);
  const currentStepExtraMessage = useMemo(() => {
    if (!currentRunStep) {
      return '';
    }
    if (currentRunStep.type === 'popup') {
      const popupMessage = getStepFieldStringValue(currentRunStep, 'message');
      return popupMessage.trim();
    }
    if (currentRunStep.type === 'input') {
      const selector = getStepFieldStringValue(currentRunStep, 'selector');
      return selector.trim();
    }
    if (currentRunStep.type === 'click') {
      const selector = getStepFieldStringValue(currentRunStep, 'selector');
      return selector.trim();
    }
    return '';
  }, [currentRunStep]);

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
  const pendingDeleteFlow = pendingDeleteFlowId
    ? flows.find((item) => item.id === pendingDeleteFlowId) ?? null
    : null;

  useEffect(() => {
    if (createFlowOpen) {
      setActiveFlowId(null);
      setEditFlow(null);
      setEditFlowSnapshot('');
      setEditResetKey((prev) => prev + 1);
      setCreateResetKey((prev) => prev + 1);
      setDraftFlow({ name: '', description: '', steps: [] });
    }
  }, [createFlowOpen]);

  useEffect(() => {
    setActiveFlowId(null);
    setEditFlow(null);
    setEditFlowSnapshot('');
    setEditResetKey((prev) => prev + 1);
    setDraftFlow({ name: '', description: '', steps: [] });
    setCreateResetKey((prev) => prev + 1);
    setPendingDeleteFlowId(null);
    setPendingDiscardEdit(false);
  }, [normalizedSiteKey]);

  const loadFlows = useCallback(async () => {
    if (!normalizedSiteKey) {
      setFlows([]);
      setFlowLoadError('');
      return;
    }
    try {
      const data = await getSiteData(normalizedSiteKey);
      const next = (Array.isArray(data.flows) ? data.flows : [])
        .map((item) =>
          normalizeFlow(item, normalizedSiteKey, t('sidepanel_flows_new_default', 'New flow')),
        )
        .filter((item): item is FlowRecord => Boolean(item));
      setFlows(next);
      setFlowLoadError('');
    } catch (error) {
      console.warn('site-load-failed', error);
      setFlowLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [normalizedSiteKey]);

  useEffect(() => {
    void loadFlows();
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
      void loadFlows();
    };
    storage.addListener(handleStorageChange);
    return () => storage.removeListener(handleStorageChange);
  }, [loadFlows, normalizedSiteKey]);

  const persistFlows = useCallback(
    async (nextFlows: FlowRecord[]) => {
      if (!normalizedSiteKey) {
        throw new Error('site-key-missing');
      }
      await setSiteData(normalizedSiteKey, { flows: nextFlows });
    },
    [normalizedSiteKey],
  );

  const openFlowEditor = useCallback(
    (flowId: string) => {
      const selected = flows.find((flow) => flow.id === flowId);
      if (!selected) {
        return;
      }
      setFlowActionError('');
      setActiveFlowId(flowId);
      const nextEditFlow = {
        ...selected,
        description: selected.description || '',
      };
      setEditFlow(nextEditFlow);
      setEditFlowSnapshot(getEditableSnapshot(nextEditFlow));
      setEditResetKey((prev) => prev + 1);
    },
    [flows],
  );

  const forceCloseEditDrawer = useCallback(() => {
    setActiveFlowId(null);
    setEditFlow(null);
    setEditFlowSnapshot('');
  }, []);

  const closeEditDrawer = useCallback(() => {
    if (isEditDirty) {
      setPendingDiscardEdit(true);
      return;
    }
    forceCloseEditDrawer();
  }, [forceCloseEditDrawer, isEditDirty]);

  const closeCreateDrawer = useCallback(() => {
    onCreateFlowClose?.();
  }, [onCreateFlowClose]);

  const saveEditedFlow = useCallback(
    async (closeDrawer = true): Promise<FlowRecord | null> => {
      if (!editFlow) {
        return null;
      }
      if (!normalizedSiteKey) {
        setFlowActionError(
          t('sidepanel_flows_persist_error_save', 'Failed to save flow. Please try again.'),
        );
        return null;
      }
      const updatedAt = Date.now();
      const nextFlow: FlowRecord = {
        ...editFlow,
        name: editFlow.name.trim() || t('sidepanel_flows_new_default', 'New flow'),
        description: editFlow.description.trim(),
        updatedAt,
      };
      const passwordValidationError = validateNoLiteralPasswordsInFlow(nextFlow);
      if (passwordValidationError) {
        setFlowActionError(passwordValidationError);
        return null;
      }
      const exists = flows.some((item) => item.id === nextFlow.id);
      const next = exists
        ? flows.map((item) => (item.id === nextFlow.id ? nextFlow : item))
        : [...flows, nextFlow];
      try {
        await persistFlows(next);
      } catch {
        setFlowActionError(
          t('sidepanel_flows_persist_error_save', 'Failed to save flow. Please try again.'),
        );
        return null;
      }
      setFlowActionError('');
      setFlows(next);
      setEditFlow(nextFlow);
      setEditFlowSnapshot(getEditableSnapshot(nextFlow));
      if (closeDrawer) {
        forceCloseEditDrawer();
      }
      return nextFlow;
    },
    [editFlow, forceCloseEditDrawer, flows, normalizedSiteKey, persistFlows],
  );

  const createDraftFlow = useCallback(async (): Promise<FlowRecord | null> => {
    if (!normalizedSiteKey) {
      setFlowActionError(
        t('sidepanel_flows_persist_error_create', 'Failed to create flow. Please try again.'),
      );
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
    const passwordValidationError = validateNoLiteralPasswordsInFlow(nextFlow);
    if (passwordValidationError) {
      setFlowActionError(passwordValidationError);
      return null;
    }
    const next = [...flows, nextFlow];
    try {
      await persistFlows(next);
    } catch {
      setFlowActionError(
        t('sidepanel_flows_persist_error_create', 'Failed to create flow. Please try again.'),
      );
      return null;
    }
    setFlowActionError('');
    setFlows(next);
    closeCreateDrawer();
    return nextFlow;
  }, [
    closeCreateDrawer,
    draftFlow.description,
    draftFlow.name,
    draftFlow.steps,
    flows,
    normalizedSiteKey,
    persistFlows,
  ]);

  const handleFlowSave = () => {
    void saveEditedFlow(true);
  };

  const handleFlowSaveRun = () => {
    void (async () => {
      const saved = await saveEditedFlow(false);
      if (!saved) {
        return;
      }
      await startFlowRun(saved, 'flow-drawer-save-run');
    })();
  };

  const handleCreateFlow = () => {
    void createDraftFlow();
  };

  const handleCreateFlowSaveRun = () => {
    void (async () => {
      const created = await createDraftFlow();
      if (!created) {
        return;
      }
      await startFlowRun(created, 'flow-drawer-save-run');
    })();
  };

  const handleDeleteFlow = useCallback(
    async (flowId: string) => {
      const next = flows.filter((item) => item.id !== flowId);
      try {
        await persistFlows(next);
      } catch {
        setFlowActionError(
          t('sidepanel_flows_persist_error_delete', 'Failed to delete flow. Please try again.'),
        );
        return;
      }
      setFlowActionError('');
      setFlows(next);
      if (activeFlowId === flowId) {
        forceCloseEditDrawer();
      }
    },
    [activeFlowId, flows, forceCloseEditDrawer, persistFlows],
  );

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
          title={actions.disableSaveRun ? actions.saveRunDisabledReason : undefined}
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
          title={actions.disableRun ? actions.runDisabledReason : undefined}
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

      {flowActionError ? (
        <Card className="border-destructive/60 bg-destructive/10 text-destructive">
          <p className="text-xs">{flowActionError}</p>
        </Card>
      ) : null}
      {flowLoadError ? (
        <Card className="border-destructive/60 bg-destructive/10 text-destructive">
          <p className="text-xs">
            {t('sidepanel_flows_load_error', 'Failed to load flows. Showing the last known list.')}
          </p>
        </Card>
      ) : null}

      {!hasActivePage ? (
        <Card className="border-border/70 bg-muted/50 text-sm text-muted-foreground">
          {t(
            'sidepanel_flows_no_active_page_readonly',
            'No active page detected. You can browse flows in read-only mode. Running is disabled.',
          )}
        </Card>
      ) : null}

      {(runStatus || runErrorMessage) && (
        <Card className="border border-border/70 bg-muted/50">
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t('sidepanel_flow_runner_status_title', 'Runner status')}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-card-foreground">
                      {getRunnerStateLabel(runStatus?.state)}
                    </p>
                    {runStatus ? (
                      <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {t('sidepanel_flow_runner_progress', '{done}/{total} steps')
                          .replace('{done}', String(runStatus.progress.completedSteps))
                          .replace('{total}', String(runStatus.progress.totalSteps))}
                      </span>
                    ) : null}
                  </div>
                  {currentRunFlow?.name ? (
                    <p className="truncate text-xs text-muted-foreground">{currentRunFlow.name}</p>
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
            </div>

            <div className="rounded-lg border border-border bg-card/70 p-3">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {t('sidepanel_flow_runner_current_step_card_title', 'Current step')}
              </p>
              <div className="mt-2 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {getStepTypeLabel(currentRunStep?.type)}
                  </span>
                  <p className="min-w-0 truncate text-sm font-semibold text-card-foreground">
                    {currentRunStep?.title?.trim() ||
                      (runStatus?.currentStepId
                        ? t('sidepanel_flow_runner_current_step_running_generic', 'Running the current step...')
                        : t('sidepanel_flow_runner_current_step_idle', 'No step is currently running.'))}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">{currentStepDetailMessage}</p>
                {currentStepExtraMessage ? (
                  <p className="truncate text-[11px] text-muted-foreground/90">{currentStepExtraMessage}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card/70 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {t('sidepanel_flow_runner_logs_title', 'Execution logs')}
                </p>
                <div className="flex items-center gap-2">
                  {hasMoreRunLogs ? (
                    <button
                      type="button"
                      className="btn-ghost h-7 px-2 text-[11px]"
                      onClick={() => setRunLogsExpanded((prev) => !prev)}
                    >
                      {runLogsExpanded
                        ? t('sidepanel_flow_runner_logs_show_recent', 'Show recent 5')
                        : t('sidepanel_flow_runner_logs_show_all', 'Show all')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-ghost h-7 px-2 text-[11px]"
                    onClick={() => void copyRunLogs()}
                    aria-label={t('sidepanel_flow_runner_logs_copy', 'Copy logs')}
                    title={t('sidepanel_flow_runner_logs_copy', 'Copy logs')}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Copy className="h-3.5 w-3.5" />
                      {t('sidepanel_flow_runner_logs_copy', 'Copy logs')}
                    </span>
                  </button>
                </div>
              </div>
              {runLogCopyFeedback ? (
                <p className="mt-1 text-[10px] text-muted-foreground">{runLogCopyFeedback}</p>
              ) : null}
              {!runLogsExpanded && hasMoreRunLogs ? (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t('sidepanel_flow_runner_logs_showing_recent', 'Showing latest {count} logs')
                    .replace('{count}', '5')}
                </p>
              ) : null}
              <div ref={runLogScrollRef} className="mt-2 max-h-44 overflow-y-auto pr-1">
                {runLogs.length ? (
                  <div className="space-y-1">
                    {visibleRunLogs.map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded px-1 py-0.5 text-[11px] ${
                          entry.level === 'error'
                            ? 'bg-destructive/8 text-destructive'
                            : entry.level === 'success'
                              ? 'bg-primary/5 text-foreground'
                              : 'text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {formatLogTime(entry.timestamp)}
                          </span>
                          <span className="min-w-0 break-all">{entry.message}</span>
                        </div>
                      </div>
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

      {flows.length === 0 ? (
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
            <Card key={flow.id} onClick={hasActivePage ? () => openFlowEditor(flow.id) : undefined}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
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
                    title={runDisabledReason || t('sidepanel_flows_run', 'Run flow')}
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
                    title={
                      hasActivePage
                        ? t('sidepanel_flows_delete', 'Delete flow')
                        : t('sidepanel_flows_disabled_read_only', 'Read-only mode without an active page.')
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDeleteFlowId(flow.id);
                    }}
                    disabled={!hasActivePage}
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
          disableSave: !hasActivePage,
          disableSaveRun: !hasActivePage || isRunActive,
          disableRun: !hasActivePage || isRunActive || !editFlow,
          saveRunDisabledReason: runDisabledReason,
          runDisabledReason: runDisabledReason,
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
          disableSave: !hasActivePage,
          disableSaveRun: !hasActivePage || isRunActive,
          disableRun: true,
          saveRunDisabledReason: runDisabledReason,
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
      <ConfirmDialog
        open={pendingDiscardEdit}
        title={t('sidepanel_action_discard', 'Discard changes')}
        message={t('sidepanel_flows_dirty_close_confirm', 'You have unsaved changes. Discard them and close?')}
        confirmLabel={t('sidepanel_action_discard', 'Discard')}
        cancelLabel={t('sidepanel_action_cancel', 'Cancel')}
        danger
        onCancel={() => setPendingDiscardEdit(false)}
        onConfirm={() => {
          setPendingDiscardEdit(false);
          forceCloseEditDrawer();
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteFlowId)}
        title={t('sidepanel_flows_delete', 'Delete flow')}
        message={t('sidepanel_flows_delete_confirm', 'Delete flow "{name}"? This action cannot be undone.').replace(
          '{name}',
          pendingDeleteFlow?.name || '',
        )}
        confirmLabel={t('sidepanel_action_delete', 'Delete')}
        cancelLabel={t('sidepanel_action_cancel', 'Cancel')}
        danger
        onCancel={() => setPendingDeleteFlowId(null)}
        onConfirm={() => {
          const targetId = pendingDeleteFlowId;
          setPendingDeleteFlowId(null);
          if (!targetId) {
            return;
          }
          void handleDeleteFlow(targetId);
        }}
      />
    </section>
  );
}
