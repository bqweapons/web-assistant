export default function FlowsSection() {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Action flows</h2>
          <p className="text-xs text-slate-500">Build reusable flows and attach them to buttons.</p>
        </div>
        <button type="button" className="btn-primary">
          New flow
        </button>
      </header>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No flows yet. Create one to define automated actions.
      </div>
    </section>
  );
}
