import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crosshair, Eye, EyeOff, Search, Sparkles, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import SelectorInput from '../components/SelectorInput';
import { t } from '../utils/i18n';
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
  scope: 'page' | 'site' | 'global';
  siteKey: string;
  pageKey: string | null;
  note: string;
  enabled: boolean;
  updatedAt: number;
};

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
    scope: value.scope === 'page' || value.scope === 'global' ? value.scope : 'site',
    siteKey: site,
    pageKey: typeof value.pageKey === 'string' ? value.pageKey : null,
    selector: typeof value.selector === 'string' ? value.selector : '',
    enabled: value.enabled !== false,
    updatedAt: toTimestamp(value.updatedAt),
  };
};

const toSiteLabel = (siteKey: string) => buildDefaultSiteUrl(siteKey || '');

export default function HiddenRulesSection({
  siteKey = '',
  pageKey = '',
  hasActivePage = false,
  onStartPicker,
}: HiddenRulesSectionProps) {
  const normalizedSiteKey = useMemo(() => deriveSiteKey(siteKey), [siteKey]);
  const [rules, setRules] = useState<HiddenRuleRecord[]>([]);
  const actionClass = 'btn-icon h-8 w-8';
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('recent');
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const siteRules = useMemo(
    () => rules.filter((rule) => !normalizedSiteKey || rule.siteKey === normalizedSiteKey),
    [normalizedSiteKey, rules],
  );
  const activeRule = siteRules.find((rule) => rule.id === activeRuleId) ?? null;
  const [editRule, setEditRule] = useState<HiddenRuleRecord | null>(activeRule);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRules = useMemo(() => {
    return siteRules.filter((rule) => {
      if (!normalizedQuery) {
        return true;
      }
      const haystack = `${rule.name} ${rule.note} ${rule.selector} ${rule.siteKey}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, siteRules]);
  const visibleRules = useMemo(() => {
    const items = [...filteredRules];
    if (sortMode === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name));
      return items;
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    return items;
  }, [filteredRules, sortMode]);
  const enabledCount = siteRules.filter((rule) => rule.enabled).length;
  const showClear = Boolean(searchQuery) || sortMode !== 'recent';
  const currentSite = toSiteLabel(normalizedSiteKey);

  const loadHiddenRules = useCallback(() => {
    if (!normalizedSiteKey) {
      setRules([]);
      return;
    }
    getSiteData(normalizedSiteKey)
      .then((data) => {
        const next = (Array.isArray(data.hidden) ? data.hidden : [])
          .map((entry) => normalizeHiddenRule(entry, normalizedSiteKey))
          .filter((entry): entry is HiddenRuleRecord => Boolean(entry));
        setRules(next);
      })
      .catch(() => setRules([]));
  }, [normalizedSiteKey]);

  useEffect(() => {
    loadHiddenRules();
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
      loadHiddenRules();
    };
    storage.addListener(handleStorageChange);
    return () => storage.removeListener(handleStorageChange);
  }, [loadHiddenRules, normalizedSiteKey]);

  const persistHiddenRules = useCallback(
    (nextRules: HiddenRuleRecord[]) => {
      if (!normalizedSiteKey) {
        return;
      }
      setSiteData(normalizedSiteKey, { hidden: nextRules }).catch(() => undefined);
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
  }, [activeRule]);

  const handleRuleSave = () => {
    if (!editRule) {
      return;
    }
    const updatedAt = Date.now();
    setRules((prev) => {
      const next = prev.map((item) =>
        item.id === editRule.id ? { ...item, ...editRule, updatedAt } : item,
      );
      persistHiddenRules(next);
      return next;
    });
    setActiveRuleId(null);
  };

  const handleRuleToggle = (ruleId: string) => {
    setRules((prev) => {
      const next = prev.map((item) =>
        item.id === ruleId ? { ...item, enabled: !item.enabled, updatedAt: Date.now() } : item,
      );
      persistHiddenRules(next);
      return next;
    });
  };

  const handleRuleDelete = (ruleId: string) => {
    setRules((prev) => {
      const next = prev.filter((item) => item.id !== ruleId);
      persistHiddenRules(next);
      return next;
    });
    if (activeRuleId === ruleId) {
      setActiveRuleId(null);
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
    const now = Date.now();
    const newRule: HiddenRuleRecord = {
      id: createRuleId(),
      name: t('sidepanel_hidden_default_name', 'Hidden rule'),
      note: '',
      scope: 'site',
      siteKey: normalizedSiteKey,
      pageKey: pageKey || null,
      selector,
      enabled: true,
      updatedAt: now,
    };
    setRules((prev) => {
      const next = [newRule, ...prev];
      persistHiddenRules(next);
      return next;
    });
    setActiveRuleId(newRule.id);
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
        <button type="button" className="btn-ghost w-full gap-2" disabled>
          <Sparkles className="h-4 w-4" />
          {t('sidepanel_hidden_action_auto', 'Auto hide ads')}
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          {t('sidepanel_hidden_status', '{count} rules active on {site}')
            .replace('{count}', String(enabledCount))
            .replace('{site}', currentSite || 'site')}
        </span>
      </div>

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
        <div className="flex items-center gap-2">
          <select
            className="input select w-full sm:w-40"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="recent">{t('sidepanel_hidden_sort_recent', 'Recently updated')}</option>
            <option value="name">{t('sidepanel_hidden_sort_name', 'Name')}</option>
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
          {t('sidepanel_elements_no_active_page', 'No active page detected. Open a site tab and refresh to manage elements.')}
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
                    <h3 className="truncate text-sm font-semibold text-card-foreground">{title}</h3>
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
                        handleRuleDelete(rule.id);
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
        onClose={() => setActiveRuleId(null)}
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
              <span className="text-foreground">{toSiteLabel(editRule.siteKey)}</span>
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
              <button type="button" className="btn-ghost" onClick={() => setActiveRuleId(null)}>
                {t('sidepanel_action_cancel', 'Cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={handleRuleSave}>
                {t('sidepanel_action_save_changes', 'Save changes')}
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}
