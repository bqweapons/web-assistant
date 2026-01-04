import { useState } from 'react';
import { EyeOff, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import { mockHiddenRules } from '../utils/mockData';

export default function HiddenRulesSection() {
  const preferredSite = 'www.yahoo.co.jp';
  const currentSite =
    mockHiddenRules.find((rule) => rule.site === preferredSite)?.site ??
    mockHiddenRules[0]?.site ??
    'site';
  const rules = mockHiddenRules.filter((rule) => rule.site === currentSite);
  const actionClass = 'btn-icon h-8 w-8';
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const activeRule = rules.find((rule) => rule.id === activeRuleId) ?? null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-card-foreground">Hidden rules</h3>
          <p className="text-xs text-muted-foreground">Site: {currentSite}</p>
        </div>
        <span className="text-xs text-muted-foreground">{rules.length}</span>
      </div>

      {rules.length === 0 ? (
        <Card className="border-dashed bg-muted text-center text-xs text-muted-foreground">
          No hidden rules yet.
        </Card>
      ) : (
        <div className="grid gap-2">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              onClick={() => setActiveRuleId(rule.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-card-foreground">{rule.selector}</h4>
                <div className="flex items-center gap-1">
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
              <p className="mt-2 text-xs text-muted-foreground">{rule.name}</p>
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
        description="Check and tune this rule."
        onClose={() => setActiveRuleId(null)}
      >
        {activeRule ? (
          <>
            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span>Selector</span>
                <span className="text-foreground">{activeRule.selector}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Scope</span>
                <span className="text-foreground">{activeRule.scope}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Last updated</span>
                <span className="text-foreground">{activeRule.updatedAt}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">This is a placeholder drawer for future actions.</p>
          </>
        ) : null}
      </Drawer>
    </section>
  );
}



