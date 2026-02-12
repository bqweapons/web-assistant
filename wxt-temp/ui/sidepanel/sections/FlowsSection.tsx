import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Play, Search, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import FlowDrawer from '../components/FlowDrawer';
import FlowStepsBuilder, { type StepData as FlowStepData } from '../components/FlowStepsBuilder';
import { t } from '../utils/i18n';
import type { SelectorPickerAccept } from '../../../shared/messages';
import { getSiteData, setSiteData, STORAGE_KEY } from '../../../shared/storage';
import { buildDefaultSiteUrl, deriveSiteKey, type StructuredFlowRecord } from '../../../shared/siteDataSchema';
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

const getSiteLabel = (siteKey: string) => {
  if (!siteKey) {
    return 'site';
  }
  return buildDefaultSiteUrl(siteKey);
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
  const activeFlow = flows.find((flow) => flow.id === activeFlowId) ?? null;
  const [editFlow, setEditFlow] = useState<FlowRecord | null>(activeFlow);
  const [draftFlow, setDraftFlow] = useState({
    name: '',
    description: '',
    steps: [] as FlowStepData[],
  });

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

  useEffect(() => {
    if (!activeFlow) {
      setEditFlow(null);
      return;
    }
    setEditFlow({
      ...activeFlow,
      description: activeFlow.description || '',
    });
  }, [activeFlow]);

  useEffect(() => {
    if (createFlowOpen) {
      setActiveFlowId(null);
      setDraftFlow({ name: '', description: '', steps: [] });
    }
  }, [createFlowOpen]);

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

  const handleFlowSave = () => {
    if (!editFlow) {
      return;
    }
    const updatedAt = Date.now();
    setFlows((prev) => {
      const next = prev.map((item) => (item.id === editFlow.id ? { ...item, ...editFlow, updatedAt } : item));
      persistFlows(next);
      return next;
    });
    setActiveFlowId(null);
  };

  const handleCreateFlow = () => {
    if (!normalizedSiteKey) {
      return;
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
    onCreateFlowClose?.();
  };

  const renderSummary = (steps: number, onSave: () => void) => (
    <>
      <p className="text-xs font-semibold text-muted-foreground">
        {t('sidepanel_flows_summary_title', 'Summary')}
      </p>
      <p className="text-sm text-foreground">
        {t('sidepanel_steps_count', '{count} steps').replace('{count}', String(steps))}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary h-8 px-3 text-xs" onClick={onSave}>
          <span className="inline-flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            {t('sidepanel_action_save', 'Save')}
          </span>
        </button>
        <button
          type="button"
          className="btn-ghost h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          disabled
        >
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('sidepanel_action_save_run', 'Save & Run')}
          </span>
        </button>
        <button
          type="button"
          className="btn-ghost h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          disabled
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
            <Card key={flow.id} onClick={() => setActiveFlowId(flow.id)}>
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
                    onClick={(event) => event.stopPropagation()}
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
        open={Boolean(activeFlow)}
        title={activeFlow?.name ?? t('sidepanel_flows_detail_title', 'Flow details')}
        subtitle={t('sidepanel_flows_detail_subtitle', 'Edit the flow settings below.')}
        onClose={() => setActiveFlowId(null)}
        summary={renderSummary(getStepCount(editFlow?.steps || []), handleFlowSave)}
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
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs">
              <span className="font-semibold text-muted-foreground">{t('sidepanel_field_site', 'Site')}</span>
              <span className="text-foreground">{getSiteLabel(editFlow.siteKey)}</span>
            </div>
            <FlowStepsBuilder
              steps={editFlow.steps}
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
        onClose={() => onCreateFlowClose?.()}
        summary={renderSummary(getStepCount(draftFlow.steps), handleCreateFlow)}
      >
        <div className="space-y-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs">
            <span className="font-semibold text-muted-foreground">{t('sidepanel_field_site', 'Site')}</span>
            <span className="text-foreground">{getSiteLabel(normalizedSiteKey)}</span>
          </div>
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
