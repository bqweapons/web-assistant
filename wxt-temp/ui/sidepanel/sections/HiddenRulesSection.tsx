import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Eye, EyeOff, Search, Sparkles, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import SelectorInput from '../components/SelectorInput';
import { t } from '../utils/i18n';
import { formatLocalDateTime } from '../utils/dateTime';
import type { SelectorPickerAccept } from '../../../shared/messages';
import { getSiteData, setSiteData, STORAGE_KEY } from '../../../shared/storage';
import { buildDefaultSiteUrl, deriveSiteKey, type StructuredHiddenRecord } from '../../../shared/siteDataSchema';

type HiddenRulesSectionProps = {
  siteKey?: string;
  pageKey?: string;
  hasActivePage?: boolean;
  onStartPicker?: (accept: SelectorPickerAccept) => Promise<string | null>;
};

type HiddenRuleRecord = StructuredHiddenRecord & {
  scope: 'site';
  siteKey: string;
  pageKey: null;
  note: string;
  enabled: boolean;
  updatedAt: number;
};

type HiddenFilterMode = 'all' | 'enabled' | 'paused' | 'auto' | 'manual';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const AUTO_ADS_RULE_PREFIX = 'hidden-auto-ads-v1-';
const AUTO_ADS_PRESETS = [
  { key: 'doubleclick-iframe', selector: 'iframe[src*="doubleclick.net"]' },
  { key: 'googlesyndication-iframe', selector: 'iframe[src*="googlesyndication.com"]' },
  { key: 'google-ads-id', selector: '[id*="google_ads"]' },
  { key: 'google-ad-class', selector: '[class*="google-ad"]' },
  { key: 'ad-prefix-id', selector: '[id^="ad-"]' },
  { key: 'ad-infix-id', selector: '[id*="-ad-"]' },
  { key: 'ad-prefix-class', selector: '[class^="ad-"]' },
  { key: 'ad-infix-class', selector: '[class*="-ad-"]' },
  { key: 'advert-class', selector: '[class*="advert"]' },
  { key: 'advert-id', selector: '[id*="advert"]' },
  { key: 'data-ad', selector: '[data-ad]' },
  { key: 'aria-label-advert', selector: '[aria-label*="advert"]' },
] as const;

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

const formatTimestamp = (value: number) => {
  return formatLocalDateTime(value);
};

const normalizeHiddenRule = (value: unknown, fallbackSiteKey: string): HiddenRuleRecord | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : '';
  if (!id) {
    return null;
  }
  const site =
    deriveSiteKey(typeof value.siteKey === 'string' ? value.siteKey : '') || fallbackSiteKey;
  if (!site) {
    return null;
  }
  return {
    id,
    name:
      typeof value.name === 'string' && value.name.trim()
        ? value.name.trim()
        : t('sidepanel_hidden_default_name', 'Hidden rule'),
    note: typeof value.note === 'string' ? value.note : '',
    scope: 'site',
    siteKey: site,
    pageKey: null,
    selector: typeof value.selector === 'string' ? value.selector : '',
    enabled: value.enabled !== false,
    updatedAt: toTimestamp(value.updatedAt),
  };
};

const isAutoAdsRule = (rule: HiddenRuleRecord) => rule.id.startsWith(AUTO_ADS_RULE_PREFIX);

const isSelectorSyntaxValid = (selector: string) => {
  const normalized = selector.trim();
  if (!normalized) {
    return false;
  }
  try {
    document.querySelector(normalized);
    return true;
  } catch {
    return false;
  }
};

export default function HiddenRulesSection({
  siteKey = '',
  pageKey: _pageKey = '',
  hasActivePage = false,
  onStartPicker,
}: HiddenRulesSectionProps) {
  const normalizedSiteKey = useMemo(() => deriveSiteKey(siteKey), [siteKey]);
  const [rules, setRules] = useState<HiddenRuleRecord[]>([]);
  const rulesRef = useRef<HiddenRuleRecord[]>([]);
  const actionClass = 'btn-icon h-8 w-8';
  const [actionError, setActionError] = useState('');
  const [hiddenLoadError, setHiddenLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('recent');
  const [filterMode, setFilterMode] = useState<HiddenFilterMode>('all');
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [pendingDeleteRuleId, setPendingDeleteRuleId] = useState<string | null>(null);
  const [pendingDiscardEdit, setPendingDiscardEdit] = useState(false);
  const [editRuleSnapshot, setEditRuleSnapshot] = useState('');
  const siteRules = useMemo(
    () => rules.filter((rule) => !normalizedSiteKey || rule.siteKey === normalizedSiteKey),
    [normalizedSiteKey, rules],
  );
  const pendingDeleteRule = pendingDeleteRuleId
    ? siteRules.find((rule) => rule.id === pendingDeleteRuleId) ?? null
    : null;
  const activeRule = siteRules.find((rule) => rule.id === activeRuleId) ?? null;
  const [editRule, setEditRule] = useState<HiddenRuleRecord | null>(activeRule);
  const isEditDirty =
    Boolean(editRule) &&
    JSON.stringify({
      name: editRule?.name || '',
      selector: editRule?.selector || '',
      note: editRule?.note || '',
      enabled: Boolean(editRule?.enabled),
    }) !== editRuleSnapshot;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRules = useMemo(() => {
    return siteRules.filter((rule) => {
      if (filterMode === 'enabled' && !rule.enabled) {
        return false;
      }
      if (filterMode === 'paused' && rule.enabled) {
        return false;
      }
      if (filterMode === 'auto' && !isAutoAdsRule(rule)) {
        return false;
      }
      if (filterMode === 'manual' && isAutoAdsRule(rule)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = `${rule.name} ${rule.note} ${rule.selector} ${rule.siteKey}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [filterMode, normalizedQuery, siteRules]);
  const visibleRules = useMemo(() => {
    const items = [...filteredRules];
    if (sortMode === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name));
      return items;
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return items;
  }, [filteredRules, sortMode]);
  const showClear = Boolean(searchQuery) || filterMode !== 'all' || sortMode !== 'recent';
  const allAutoAdsEnabled = AUTO_ADS_PRESETS.every((preset) => {
    const id = `${AUTO_ADS_RULE_PREFIX}${preset.key}`;
    const existing = siteRules.find((rule) => rule.id === id);
    return Boolean(existing && existing.enabled);
  });

  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  const loadHiddenRules = useCallback(async () => {
    if (!normalizedSiteKey) {
      setRules([]);
      setHiddenLoadError('');
      return;
    }
    try {
      const data = await getSiteData(normalizedSiteKey);
      const next = (Array.isArray(data.hidden) ? data.hidden : [])
        .map((entry) => normalizeHiddenRule(entry, normalizedSiteKey))
        .filter((entry): entry is HiddenRuleRecord => Boolean(entry));
      setRules(next);
      setHiddenLoadError('');
    } catch (error) {
      console.warn('site-load-failed', error);
      setHiddenLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [normalizedSiteKey]);

  useEffect(() => {
    void loadHiddenRules();
  }, [loadHiddenRules]);

  useEffect(() => {
    const storage = chrome?.storage?.onChanged;
    if (!storage || !normalizedSiteKey) {
      return;
    }
    const handleStorageChange = (changes: Record<string, unknown>, areaName: string) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY]) {
        return;
      }
      void loadHiddenRules();
    };
    storage.addListener(handleStorageChange);
    return () => storage.removeListener(handleStorageChange);
  }, [loadHiddenRules, normalizedSiteKey]);

  useEffect(() => {
    setActiveRuleId(null);
    setPendingDeleteRuleId(null);
    setPendingDiscardEdit(false);
  }, [normalizedSiteKey]);

  const persistHiddenRules = useCallback(
    async (nextRules: HiddenRuleRecord[], errorMessage: string) => {
      if (!normalizedSiteKey) {
        setActionError(errorMessage);
        return false;
      }
      try {
        await setSiteData(normalizedSiteKey, { hidden: nextRules });
        setRules(nextRules);
        setActionError('');
        return true;
      } catch {
        setActionError(errorMessage);
        return false;
      }
    },
    [normalizedSiteKey],
  );

  const createRuleId = () => `hidden-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  useEffect(() => {
    if (!activeRule) {
      setEditRule(null);
      return;
    }
    setEditRule({
      ...activeRule,
      note: activeRule.note || '',
      enabled: activeRule.enabled !== false,
    });
    setEditRuleSnapshot(
      JSON.stringify({
        name: activeRule.name || '',
        selector: activeRule.selector || '',
        note: activeRule.note || '',
        enabled: activeRule.enabled !== false,
      }),
    );
  }, [activeRule]);

  const closeRuleDrawer = () => {
    if (isEditDirty) {
      setPendingDiscardEdit(true);
      return;
    }
    setActiveRuleId(null);
    setEditRule(null);
    setEditRuleSnapshot('');
  };

  const handleRuleSave = async () => {
    if (!editRule) {
      return;
    }
    const selector = editRule.selector.trim();
    if (!isSelectorSyntaxValid(selector)) {
      setActionError(t('sidepanel_hidden_invalid_selector', 'Selector is invalid.'));
      return;
    }
    const updatedAt = Date.now();
    const nextRule: HiddenRuleRecord = {
      ...editRule,
      name: editRule.name.trim() || t('sidepanel_hidden_default_name', 'Hidden rule'),
      selector,
      scope: 'site',
      siteKey: normalizedSiteKey || editRule.siteKey,
      pageKey: null,
      updatedAt,
    };
    const next = rulesRef.current.map((item) => (item.id === editRule.id ? nextRule : item));
    const persisted = await persistHiddenRules(
      next,
      t('sidepanel_hidden_persist_error_save', 'Failed to save rule. Please try again.'),
    );
    if (!persisted) {
      return;
    }
    closeRuleDrawer();
  };

  const handleRuleToggle = async (ruleId: string) => {
    const next = rulesRef.current.map((item) =>
      item.id === ruleId ? { ...item, enabled: !item.enabled, updatedAt: Date.now() } : item,
    );
    await persistHiddenRules(
      next,
      t('sidepanel_hidden_persist_error_save', 'Failed to save rule. Please try again.'),
    );
  };

  const handleRuleDelete = async (ruleId: string) => {
    const next = rulesRef.current.filter((item) => item.id !== ruleId);
    const persisted = await persistHiddenRules(
      next,
      t('sidepanel_hidden_persist_error_delete', 'Failed to delete rule. Please try again.'),
    );
    if (!persisted) {
      return;
    }
    if (activeRuleId === ruleId) {
      closeRuleDrawer();
    }
  };

  const handleCreateFromPicker = async () => {
    if (!onStartPicker || !normalizedSiteKey || !hasActivePage) {
      return;
    }
    const selector = await onStartPicker('selector');
    if (!selector) {
      return;
    }
    const normalizedSelector = selector.trim();
    if (!isSelectorSyntaxValid(normalizedSelector)) {
      setActionError(t('sidepanel_hidden_invalid_selector', 'Selector is invalid.'));
      return;
    }
    const now = Date.now();
    const newRule: HiddenRuleRecord = {
      id: createRuleId(),
      name: t('sidepanel_hidden_default_name', 'Hidden rule'),
      note: '',
      scope: 'site',
      siteKey: normalizedSiteKey,
      pageKey: null,
      selector: normalizedSelector,
      enabled: true,
      updatedAt: now,
    };
    const next = [newRule, ...rulesRef.current];
    const persisted = await persistHiddenRules(
      next,
      t('sidepanel_hidden_persist_error_save', 'Failed to save rule. Please try again.'),
    );
    if (!persisted) {
      return;
    }
    setActiveRuleId(newRule.id);
  };

  const handleBulkEnableAll = async () => {
    if (!normalizedSiteKey) {
      return;
    }
    const now = Date.now();
    const next = rulesRef.current.map((rule) =>
      rule.siteKey === normalizedSiteKey ? { ...rule, enabled: true, updatedAt: now } : rule,
    );
    await persistHiddenRules(
      next,
      t('sidepanel_hidden_persist_error_save', 'Failed to save rule. Please try again.'),
    );
  };

  const handleBulkPauseAll = async () => {
    if (!normalizedSiteKey) {
      return;
    }
    const now = Date.now();
    const next = rulesRef.current.map((rule) =>
      rule.siteKey === normalizedSiteKey ? { ...rule, enabled: false, updatedAt: now } : rule,
    );
    await persistHiddenRules(
      next,
      t('sidepanel_hidden_persist_error_save', 'Failed to save rule. Please try again.'),
    );
  };

  const handleToggleAutoAds = async () => {
    if (!normalizedSiteKey || !hasActivePage) {
      return;
    }
    const now = Date.now();
    const next = [...rulesRef.current];
    if (allAutoAdsEnabled) {
      for (let index = 0; index < next.length; index += 1) {
        const rule = next[index];
        if (rule.siteKey !== normalizedSiteKey || !isAutoAdsRule(rule) || !rule.enabled) {
          continue;
        }
        next[index] = { ...rule, enabled: false, updatedAt: now };
      }
    } else {
      AUTO_ADS_PRESETS.forEach((preset) => {
        const presetId = `${AUTO_ADS_RULE_PREFIX}${preset.key}`;
        const existingIndex = next.findIndex((rule) => rule.id === presetId);
        const nextRule: HiddenRuleRecord = {
          id: presetId,
          name: t('sidepanel_hidden_auto_rule_name', 'Auto ad rule'),
          note: t('sidepanel_hidden_auto_rule_note', 'Generated from Auto hide ads.'),
          scope: 'site',
          siteKey: normalizedSiteKey,
          pageKey: null,
          selector: preset.selector,
          enabled: true,
          updatedAt: now,
        };
        if (existingIndex === -1) {
          next.push(nextRule);
          return;
        }
        next[existingIndex] = {
          ...next[existingIndex],
          ...nextRule,
          id: presetId,
        };
      });
    }
    await persistHiddenRules(
      next,
      t('sidepanel_hidden_persist_error_save', 'Failed to save rule. Please try again.'),
    );
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn-primary w-full gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleCreateFromPicker}
          disabled={!hasActivePage || !normalizedSiteKey}
        >
          <Crosshair className="h-4 w-4" />
          {t('sidepanel_hidden_action_select', 'Hide page element')}
        </button>
        <button
          type="button"
          className="btn-ghost w-full gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void handleToggleAutoAds();
          }}
          disabled={!hasActivePage || !normalizedSiteKey}
        >
          <Sparkles className="h-4 w-4" />
          {allAutoAdsEnabled
            ? t('sidepanel_hidden_auto_ads_off', 'Pause auto hide ads')
            : t('sidepanel_hidden_auto_ads_on', 'Enable auto hide ads')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-card-foreground">
            {t('sidepanel_hidden_title', 'Hidden rules')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('sidepanel_hidden_subtitle', 'Hide or suppress elements automatically.')}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{visibleRules.length}</span>
      </div>

      {actionError ? (
        <Card className="border-destructive/60 bg-destructive/10 text-destructive">
          <p className="text-xs">{actionError}</p>
        </Card>
      ) : null}
      {hiddenLoadError ? (
        <Card className="border-destructive/60 bg-destructive/10 text-destructive">
          <p className="text-xs">
            {t('sidepanel_hidden_load_error', 'Failed to load hidden rules. Showing the last known list.')}
          </p>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input pl-9"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('sidepanel_hidden_search_placeholder', 'Search hidden rules')}
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <select
            className="input select min-w-0 flex-1"
            value={filterMode}
            onChange={(event) => setFilterMode(event.target.value as HiddenFilterMode)}
          >
            <option value="all">{t('sidepanel_hidden_filter_all', 'All')}</option>
            <option value="enabled">{t('sidepanel_hidden_filter_enabled', 'Enabled')}</option>
            <option value="paused">{t('sidepanel_hidden_filter_paused', 'Paused')}</option>
            <option value="auto">{t('sidepanel_hidden_filter_auto', 'Auto')}</option>
            <option value="manual">{t('sidepanel_hidden_filter_manual', 'Manual')}</option>
          </select>
          <select
            className="input select min-w-0 flex-1"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="recent">{t('sidepanel_hidden_sort_recent', 'Recently updated')}</option>
            <option value="name">{t('sidepanel_hidden_sort_name', 'Name')}</option>
          </select>
          {showClear ? (
            <button
              type="button"
              className="btn-ghost h-9 shrink-0 px-3"
              onClick={() => {
                setSearchQuery('');
                setSortMode('recent');
                setFilterMode('all');
              }}
            >
              {t('sidepanel_action_clear', 'Clear')}
            </button>
          ) : null}
        </div>
      </div>

      {hasActivePage ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-ghost h-8 w-full px-3 text-xs"
            onClick={() => {
              void handleBulkEnableAll();
            }}
            disabled={!siteRules.length}
          >
            {t('sidepanel_hidden_bulk_enable_all', 'Enable all')}
          </button>
          <button
            type="button"
            className="btn-ghost h-8 w-full px-3 text-xs"
            onClick={() => {
              void handleBulkPauseAll();
            }}
            disabled={!siteRules.length}
          >
            {t('sidepanel_hidden_bulk_pause_all', 'Pause all')}
          </button>
        </div>
      ) : null}

      {!hasActivePage ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t(
            'sidepanel_hidden_no_active_page',
            'No active page detected. Open a site tab to manage hidden rules.',
          )}
        </Card>
      ) : siteRules.length === 0 ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t('sidepanel_hidden_empty', 'No hidden rules yet.')}
        </Card>
      ) : visibleRules.length === 0 ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t('sidepanel_hidden_empty_filtered', 'No matches. Try a different search or filter.')}
        </Card>
      ) : (
        <div className="grid gap-2">
          {visibleRules.map((rule) => {
            const title = rule.note || rule.name || rule.selector;
            return (
              <Card key={rule.id} onClick={() => setActiveRuleId(rule.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-card-foreground">{title}</h3>
                      {isAutoAdsRule(rule) ? (
                        <span className="badge-pill shrink-0 text-[9px] uppercase tracking-wide">
                          {t('sidepanel_hidden_filter_auto', 'Auto')}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{rule.selector}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={actionClass}
                      aria-label={
                        rule.enabled
                          ? t('sidepanel_hidden_disable', 'Disable rule')
                          : t('sidepanel_hidden_enable', 'Enable rule')
                      }
                      title={
                        rule.enabled
                          ? t('sidepanel_hidden_disable', 'Disable rule')
                          : t('sidepanel_hidden_enable', 'Enable rule')
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRuleToggle(rule.id);
                      }}
                    >
                      {rule.enabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      className={`${actionClass} btn-icon-danger`}
                      aria-label={t('sidepanel_hidden_delete', 'Delete rule')}
                      title={t('sidepanel_hidden_delete', 'Delete rule')}
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingDeleteRuleId(rule.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="badge-pill">
                    {rule.enabled
                      ? t('sidepanel_hidden_status_enabled', 'Enabled')
                      : t('sidepanel_hidden_status_paused', 'Paused')}
                  </span>
                  <span>{formatTimestamp(rule.updatedAt)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Drawer
        open={Boolean(activeRule)}
        title={activeRule?.name ?? t('sidepanel_hidden_detail_title', 'Hidden rule details')}
        description={t('sidepanel_hidden_detail_subtitle', 'Edit the hidden rule details below.')}
        onClose={closeRuleDrawer}
      >
        {editRule ? (
          <div className="grid gap-3 text-xs text-muted-foreground">
            <label className="grid gap-1">
              <span>{t('sidepanel_field_name', 'Name')}</span>
              <input
                className="input"
                value={editRule.name}
                onChange={(event) => setEditRule({ ...editRule, name: event.target.value })}
                placeholder={t('sidepanel_hidden_name_placeholder', 'Hidden rule name')}
              />
            </label>
            <label className="grid gap-1">
              <span>{t('sidepanel_field_selector', 'Selector')}</span>
              <SelectorInput
                value={editRule.selector}
                onChange={(value) => setEditRule({ ...editRule, selector: value })}
                placeholder={t('sidepanel_hidden_selector_placeholder', 'CSS selector')}
                onPick={async () => {
                  if (!onStartPicker) {
                    return;
                  }
                  const selector = await onStartPicker('selector');
                  if (!selector) {
                    return;
                  }
                  setEditRule({ ...editRule, selector });
                }}
              />
            </label>
            <label className="grid gap-1">
              <span>{t('sidepanel_field_note', 'Note')}</span>
              <textarea
                className="input"
                rows={2}
                value={editRule.note}
                onChange={(event) => setEditRule({ ...editRule, note: event.target.value })}
                placeholder={t('sidepanel_hidden_note_placeholder', 'Why this rule exists')}
              />
            </label>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs">
              <span className="font-semibold text-muted-foreground">{t('sidepanel_field_site', 'Site')}</span>
              <span className="text-foreground">{buildDefaultSiteUrl(editRule.siteKey || '')}</span>
            </div>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={editRule.enabled}
                onChange={(event) => setEditRule({ ...editRule, enabled: event.target.checked })}
              />
              <span>{t('sidepanel_hidden_enabled', 'Rule enabled')}</span>
            </label>
            <div className="grid gap-1">
              <span>{t('sidepanel_field_last_updated', 'Last updated')}</span>
              <p className="text-sm text-foreground">{formatTimestamp(editRule.updatedAt)}</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={closeRuleDrawer}>
                {t('sidepanel_action_cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  void handleRuleSave();
                }}
              >
                {t('sidepanel_action_save_changes', 'Save changes')}
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>
      <ConfirmDialog
        open={pendingDiscardEdit}
        title={t('sidepanel_action_discard', 'Discard changes')}
        message={t('sidepanel_hidden_dirty_close_confirm', 'You have unsaved changes. Discard them and close?')}
        confirmLabel={t('sidepanel_action_discard', 'Discard')}
        cancelLabel={t('sidepanel_action_cancel', 'Cancel')}
        danger
        onCancel={() => setPendingDiscardEdit(false)}
        onConfirm={() => {
          setPendingDiscardEdit(false);
          setActiveRuleId(null);
          setEditRule(null);
          setEditRuleSnapshot('');
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDeleteRuleId)}
        title={t('sidepanel_hidden_delete', 'Delete rule')}
        message={t('sidepanel_hidden_delete_confirm', 'Delete rule "{name}"? This action cannot be undone.').replace(
          '{name}',
          pendingDeleteRule?.name || pendingDeleteRule?.selector || pendingDeleteRule?.id || '',
        )}
        confirmLabel={t('sidepanel_action_delete', 'Delete')}
        cancelLabel={t('sidepanel_action_cancel', 'Cancel')}
        danger
        onCancel={() => setPendingDeleteRuleId(null)}
        onConfirm={() => {
          const targetId = pendingDeleteRuleId;
          setPendingDeleteRuleId(null);
          if (!targetId) {
            return;
          }
          void handleRuleDelete(targetId);
        }}
      />
    </section>
  );
}
