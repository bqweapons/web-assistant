import { useEffect, useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import FlowDrawer from '../components/FlowDrawer';
import FlowStepsBuilderPreview from '../components/FlowStepsBuilderPreview';
import { mockFlows } from '../utils/mockData';

type FlowsSectionProps = {
  createFlowOpen?: boolean;
  onCreateFlowClose?: () => void;
};

export default function FlowsSection({ createFlowOpen = false, onCreateFlowClose }: FlowsSectionProps) {
  const currentSite = mockFlows[0]?.site ?? 'file://';
  const [flows, setFlows] = useState(mockFlows);
  const siteFlows = flows.filter((flow) => flow.site === currentSite);
  const actionClass = 'btn-icon h-8 w-8';
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const activeFlow = siteFlows.find((flow) => flow.id === activeFlowId) ?? null;
  const [editFlow, setEditFlow] = useState(activeFlow);
  const [draftFlow, setDraftFlow] = useState({
    name: '',
    description: '',
    steps: 0,
  });

  const getStepCount = (value: number | unknown[]) => {
    if (Array.isArray(value)) {
      return value.length;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

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
      setDraftFlow({ name: '', description: '', steps: 0 });
    }
  }, [createFlowOpen]);

  const formatTimestamp = (value: number) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (segment: number) => String(segment).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const handleFlowSave = () => {
    if (!editFlow) {
      return;
    }
    setFlows((prev) => prev.map((item) => (item.id === editFlow.id ? { ...item, ...editFlow } : item)));
    setActiveFlowId(null);
  };

  const handleCreateFlow = () => {
    const name = draftFlow.name.trim() || 'New flow';
    const description = draftFlow.description.trim();
    const nextFlow = {
      id: `flow-${Date.now()}`,
      name,
      description,
      site: currentSite,
      steps: Number.isFinite(draftFlow.steps) ? Math.max(0, draftFlow.steps) : 0,
      updatedAt: formatTimestamp(Date.now()),
    };
    setFlows((prev) => [...prev, nextFlow]);
    onCreateFlowClose?.();
  };

  const renderSummary = (steps: number, onSave: () => void) => (
    <>
      <p className="text-xs font-semibold text-muted-foreground">Summary</p>
      <p className="text-sm text-foreground">{steps} steps</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary text-xs" onClick={onSave}>
          Save
        </button>
        <button type="button" className="btn-primary text-xs" disabled>
          Save &amp; Run
        </button>
        <button type="button" className="btn-primary text-xs" disabled>
          Run
        </button>
      </div>
    </>
  );

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

      <FlowDrawer
        open={Boolean(activeFlow)}
        title={activeFlow?.name ?? 'Flow details'}
        subtitle="Edit the flow settings below."
        onClose={() => setActiveFlowId(null)}
        summary={renderSummary(getStepCount(editFlow?.steps || 0), handleFlowSave)}
      >
        {editFlow ? (
          <div className="space-y-4 text-xs text-muted-foreground">
            <label className="block text-xs font-semibold text-muted-foreground">
              Name
              <input
                className="input mt-1"
                value={editFlow.name}
                onChange={(event) => setEditFlow({ ...editFlow, name: event.target.value })}
                placeholder="Flow name"
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Description
              <textarea
                className="input mt-1"
                rows={2}
                value={editFlow.description}
                onChange={(event) => setEditFlow({ ...editFlow, description: event.target.value })}
                placeholder="Describe what the flow does"
              />
            </label>
            <FlowStepsBuilderPreview />
          </div>
        ) : null}
      </FlowDrawer>

      <FlowDrawer
        open={createFlowOpen}
        title="New flow"
        subtitle="Create a new action flow."
        onClose={() => onCreateFlowClose?.()}
        summary={renderSummary(getStepCount(draftFlow.steps), handleCreateFlow)}
      >
        <div className="space-y-4 text-xs text-muted-foreground">
          <label className="block text-xs font-semibold text-muted-foreground">
            Name
            <input
              className="input mt-1"
              value={draftFlow.name}
              onChange={(event) => setDraftFlow({ ...draftFlow, name: event.target.value })}
              placeholder="Flow name"
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Description
            <textarea
              className="input mt-1"
              rows={2}
              value={draftFlow.description}
              onChange={(event) => setDraftFlow({ ...draftFlow, description: event.target.value })}
              placeholder="Describe what the flow does"
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Steps
            <input
              className="input mt-1"
              type="number"
              min="0"
              value={draftFlow.steps}
              onChange={(event) =>
                setDraftFlow({
                  ...draftFlow,
                  steps: Number(event.target.value) || 0,
                })
              }
            />
          </label>
          <FlowStepsBuilderPreview />
        </div>
      </FlowDrawer>
    </section>
  );
}



