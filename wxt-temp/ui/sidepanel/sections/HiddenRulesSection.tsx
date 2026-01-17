import { useEffect, useState } from 'react';
import { EyeOff, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import SelectorInput from '../components/SelectorInput';
import SelectMenu from '../components/SelectMenu';
import { mockHiddenRules } from '../utils/mockData';
import { t } from '../utils/i18n';

export default function HiddenRulesSection() {
  const preferredSite = 'www.yahoo.co.jp';
  const currentSite =
    mockHiddenRules.find((rule) => rule.site === preferredSite)?.site ??
    mockHiddenRules[0]?.site ??
    'site';
  const [rules, setRules] = useState(mockHiddenRules);
  const siteRules = rules.filter((rule) => rule.site === currentSite);
  const actionClass = 'btn-icon h-8 w-8';
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const activeRule = siteRules.find((rule) => rule.id === activeRuleId) ?? null;
  const [editRule, setEditRule] = useState(activeRule);

  const getScopeLabel = (value: string) => {
    if (value === 'site') {
      return t('sidepanel_scope_site', 'Site');
    }
    if (value === 'global') {
      return t('sidepanel_scope_global', 'Global');
    }
    return t('sidepanel_scope_page', 'Page');
  };

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
    setRules((prev) => prev.map((item) => (item.id === editRule.id ? { ...item, ...editRule } : item)));
    setActiveRuleId(null);
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-card-foreground">
            {t('sidepanel_hidden_title', 'Hidden rules')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('sidepanel_hidden_subtitle', 'Hide or suppress elements automatically.')}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{siteRules.length}</span>
      </div>

      {siteRules.length === 0 ? (
        <Card className="border-dashed bg-muted text-center text-xs text-muted-foreground">
          {t('sidepanel_hidden_empty', 'No hidden rules yet.')}
        </Card>
      ) : (
        <div className="grid gap-2">
          {siteRules.map((rule) => (
            <Card
              key={rule.id}
              onClick={() => setActiveRuleId(rule.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-card-foreground">
                  {rule.selector}
                </h4>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={actionClass}
                    aria-label={t('sidepanel_hidden_disable', 'Disable rule')}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`${actionClass} btn-icon-danger`}
                    aria-label={t('sidepanel_hidden_delete', 'Delete rule')}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{rule.note || rule.name}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{rule.updatedAt}</p>
                <span className="badge-pill">{getScopeLabel(rule.scope)}</span>
              </div>
            </Card>
          ))}
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
            <div className="grid gap-1">
              <span>{t('sidepanel_field_scope', 'Scope')}</span>
              <SelectMenu
                value={editRule.scope}
                options={[
                  { value: 'page', label: t('sidepanel_scope_page', 'Page') },
                  { value: 'site', label: t('sidepanel_scope_site', 'Site') },
                  { value: 'global', label: t('sidepanel_scope_global', 'Global') },
                ]}
                onChange={(value) =>
                  setEditRule({
                    ...editRule,
                    scope: value as 'page' | 'site' | 'global',
                  })
                }
              />
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
              <p className="text-sm text-foreground">{editRule.updatedAt}</p>
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



