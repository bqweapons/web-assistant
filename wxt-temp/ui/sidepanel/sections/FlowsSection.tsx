import { useEffect, useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import { mockFlows } from '../utils/mockData';

export default function FlowsSection() {
  const currentSite = mockFlows[0]?.site ?? 'file://';
  const [flows, setFlows] = useState(mockFlows);
  const siteFlows = flows.filter((flow) => flow.site === currentSite);
  const actionClass = 'btn-icon h-8 w-8';
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const activeFlow = siteFlows.find((flow) => flow.id === activeFlowId) ?? null;
  const [editFlow, setEditFlow] = useState(activeFlow);

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

  const handleFlowSave = () => {
    if (!editFlow) {
      return;
    }
    setFlows((prev) => prev.map((item) => (item.id === editFlow.id ? { ...item, ...editFlow } : item)));
    setActiveFlowId(null);
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-card-foreground">Action flows</h2>
          <p className="text-xs text-muted-foreground">Build reusable action sequences.</p>
        </div>
        <span className="text-xs text-muted-foreground">{siteFlows.length}</span>
      </div>

      {siteFlows.length === 0 ? (
        <Card className="border-dashed bg-muted text-center text-sm text-muted-foreground">
          No flows yet. Create one to define automated actions.
        </Card>
      ) : (
        <div className="grid gap-2">
          {siteFlows.map((flow) => (
            <Card
              key={flow.id}
              onClick={() => setActiveFlowId(flow.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-card-foreground">
                  {flow.name}
                </h3>
                <div className="flex shrink-0 items-center gap-1">
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
              <p className="mt-2 text-xs text-muted-foreground">{flow.description || 'No description'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{flow.steps} steps</p>
              <p className="mt-1 text-xs text-muted-foreground">{flow.updatedAt}</p>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(activeFlow)}
        title={activeFlow?.name ?? 'Flow details'}
        description="Edit the flow settings below."
        onClose={() => setActiveFlowId(null)}
      >
        {editFlow ? (
          <div className="grid gap-3 text-xs text-muted-foreground">
            <label className="grid gap-1">
              <span>Name</span>
              <input
                className="input"
                value={editFlow.name}
                onChange={(event) => setEditFlow({ ...editFlow, name: event.target.value })}
                placeholder="Flow name"
              />
            </label>
            <label className="grid gap-1">
              <span>Description</span>
              <textarea
                className="input"
                rows={3}
                value={editFlow.description}
                onChange={(event) => setEditFlow({ ...editFlow, description: event.target.value })}
                placeholder="Describe what the flow does"
              />
            </label>
            <label className="grid gap-1">
              <span>Steps</span>
              <input
                className="input"
                type="number"
                min="0"
                value={editFlow.steps}
                onChange={(event) =>
                  setEditFlow({
                    ...editFlow,
                    steps: Number(event.target.value) || 0,
                  })
                }
              />
            </label>
            <div className="grid gap-1">
              <span>Last updated</span>
              <p className="text-sm text-foreground">{editFlow.updatedAt}</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setActiveFlowId(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleFlowSave}>
                Save changes
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}



