import { useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import { mockFlows } from '../utils/mockData';

export default function FlowsSection() {
  const currentSite = mockFlows[0]?.site ?? 'file://';
  const flows = mockFlows.filter((flow) => flow.site === currentSite);
  const actionClass = 'btn-icon h-8 w-8';
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const activeFlow = flows.find((flow) => flow.id === activeFlowId) ?? null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-card-foreground">Action flows</h2>
          <p className="text-xs text-muted-foreground">Site: {currentSite}</p>
        </div>
        <span className="text-xs text-muted-foreground">{flows.length}</span>
      </div>

      {flows.length === 0 ? (
        <Card className="border-dashed bg-muted text-center text-sm text-muted-foreground">
          No flows yet. Create one to define automated actions.
        </Card>
      ) : (
        <div className="grid gap-2">
          {flows.map((flow) => (
            <Card
              key={flow.id}
              onClick={() => setActiveFlowId(flow.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-card-foreground">{flow.name}</h3>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={actionClass}
                    aria-label="Run flow"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`${actionClass} btn-icon-danger`}
                    aria-label="Delete flow"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{flow.steps} steps</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{flow.updatedAt}</p>
                <span className="badge-pill">{flow.scope}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(activeFlow)}
        title={activeFlow?.name ?? 'Flow details'}
        description="Review and adjust this flow."
        onClose={() => setActiveFlowId(null)}
      >
        {activeFlow ? (
          <>
            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span>Scope</span>
                <span className="text-foreground">{activeFlow.scope}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Steps</span>
                <span className="text-foreground">{activeFlow.steps}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Last updated</span>
                <span className="text-foreground">{activeFlow.updatedAt}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">This is a placeholder drawer for future actions.</p>
          </>
        ) : null}
      </Drawer>
    </section>
  );
}



