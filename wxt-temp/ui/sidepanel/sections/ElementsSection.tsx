import { useState } from 'react';
import { Crosshair, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import { mockElements } from '../utils/mockData';

export default function ElementsSection() {
  const currentSite = mockElements[0]?.site ?? 'file://';
  const elements = mockElements.filter((element) => element.site === currentSite);
  const actionClass = 'btn-icon h-8 w-8';
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const activeElement = elements.find((element) => element.id === activeElementId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-card-foreground">Elements</h2>
          <p className="text-xs text-muted-foreground">Site: {currentSite}</p>
        </div>
        <span className="text-xs text-muted-foreground">{elements.length}</span>
      </div>

      {elements.length === 0 ? (
        <Card className="border-dashed bg-muted text-center text-sm text-muted-foreground">
          No elements yet. Create your first element to get started.
        </Card>
      ) : (
        <div className="grid gap-2">
          {elements.map((element) => (
            <Card
              key={element.id}
              className="p-4"
              onClick={() => setActiveElementId(element.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-card-foreground">
                  {element.label || `${element.type} element`}
                </h3>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={actionClass}
                    aria-label="Locate element"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Crosshair className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`${actionClass} btn-icon-danger`}
                    aria-label="Delete element"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{element.page}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{element.updatedAt}</p>
                <span className="badge-pill">{element.type}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(activeElement)}
        title={activeElement?.label || `${activeElement?.type ?? 'Element'} details`}
        description="Edit and inspect element data."
        onClose={() => setActiveElementId(null)}
      >
        {activeElement ? (
          <>
            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span>Type</span>
                <span className="text-foreground">{activeElement.type}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Scope</span>
                <span className="text-foreground">{activeElement.scope}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Page</span>
                <span className="text-foreground">{activeElement.page}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Last updated</span>
                <span className="text-foreground">{activeElement.updatedAt}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">This is a placeholder drawer for future actions.</p>
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
