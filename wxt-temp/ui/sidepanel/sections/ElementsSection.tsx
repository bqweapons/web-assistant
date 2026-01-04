import { useMemo, useState } from 'react';
import TabBar from '../components/TabBar';

const ELEMENT_TABS = {
  create: 'create',
  hidden: 'hidden',
};

export default function ElementsSection() {
  const tabs = useMemo(
    () => [
      { id: ELEMENT_TABS.create, label: 'Create' },
      { id: ELEMENT_TABS.hidden, label: 'Hidden rules' },
    ],
    [],
  );
  const [activeTab, setActiveTab] = useState(ELEMENT_TABS.create);

  return (
    <div className="flex flex-col gap-4">
      <TabBar tabs={tabs} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === ELEMENT_TABS.create && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">Create element</h2>
              <p className="text-xs text-slate-500">Choose a type and place it on the page.</p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <select className="input select flex-1">
                <option>Button</option>
                <option>Link</option>
                <option>Tooltip</option>
                <option>Area</option>
              </select>
              <button type="button" className="btn-primary">
                Create
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Edit mode</h3>
                <p className="text-xs text-slate-500">Highlight injected elements for quick edits.</p>
              </div>
              <button type="button" className="btn-ghost">
                Disabled
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No elements yet. Create your first element to get started.
          </section>
        </>
      )}

      {activeTab === ELEMENT_TABS.hidden && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Hidden rules</h3>
              <p className="text-xs text-slate-500">Hide elements on this page or site.</p>
            </div>
            <button type="button" className="btn-ghost">
              Add rule
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            No hidden rules yet.
          </div>
        </section>
      )}
    </div>
  );
}
