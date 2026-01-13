import { useEffect, useState } from 'react';
import { EyeOff, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import SelectorInput from '../components/SelectorInput';
import SelectMenu from '../components/SelectMenu';
import { mockHiddenRules } from '../utils/mockData';

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
          <h3 className="text-sm font-semibold text-card-foreground">Hidden rules</h3>
          <p className="text-xs text-muted-foreground">Hide or suppress elements automatically.</p>
        </div>
        <span className="text-xs text-muted-foreground">{siteRules.length}</span>
      </div>

      {siteRules.length === 0 ? (
        <Card className="border-dashed bg-muted text-center text-xs text-muted-foreground">
          No hidden rules yet.
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
                    aria-label="Disable rule"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`${actionClass} btn-icon-danger`}
                    aria-label="Delete rule"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{rule.note || rule.name}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{rule.updatedAt}</p>
                <span className="badge-pill">{rule.scope}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(activeRule)}
        title={activeRule?.name ?? 'Hidden rule details'}
        description="Edit the hidden rule details below."
        onClose={() => setActiveRuleId(null)}
      >
        {editRule ? (
          <div className="grid gap-3 text-xs text-muted-foreground">
            <label className="grid gap-1">
              <span>Name</span>
              <input
                className="input"
                value={editRule.name}
                onChange={(event) => setEditRule({ ...editRule, name: event.target.value })}
                placeholder="Hidden rule name"
              />
            </label>
            <label className="grid gap-1">
              <span>Selector</span>
              <SelectorInput
                value={editRule.selector}
                onChange={(value) => setEditRule({ ...editRule, selector: value })}
                placeholder="CSS selector"
              />
            </label>
            <label className="grid gap-1">
              <span>Note</span>
              <textarea
                className="input"
                rows={2}
                value={editRule.note}
                onChange={(event) => setEditRule({ ...editRule, note: event.target.value })}
                placeholder="Why this rule exists"
              />
            </label>
            <div className="grid gap-1">
              <span>Scope</span>
              <SelectMenu
                value={editRule.scope}
                options={[
                  { value: 'page', label: 'Page' },
                  { value: 'site', label: 'Site' },
                  { value: 'global', label: 'Global' },
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
              <span>Rule enabled</span>
            </label>
            <div className="grid gap-1">
              <span>Last updated</span>
              <p className="text-sm text-foreground">{editRule.updatedAt}</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setActiveRuleId(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleRuleSave}>
                Save changes
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}



