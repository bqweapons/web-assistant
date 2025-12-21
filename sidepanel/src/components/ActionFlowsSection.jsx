import React from 'react';

export function ActionFlowsSection({ flows, onCreate, onEdit, onDelete, onRun, t }) {
  const sorted = (flows || []).slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('flow.library.heading')}</h2>
          <p className="text-sm text-slate-500">{t('flow.library.description')}</p>
        </div>
        <button
          type="button"
          className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg"
          onClick={onCreate}
        >
          {t('flow.library.createAction')}
        </button>
      </header>
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-brand">
          {t('flow.library.empty')}
        </p>
      ) : (
        <div className="grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {sorted.map((flow) => (
            <article
              key={flow.id}
              className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-brand"
            >
              <div className="space-y-1">
                <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{flow.name}</h3>
                <p className="line-clamp-2 text-xs text-slate-500">{flow.description || t('flow.library.noDescription')}</p>
                <p className="text-[11px] text-slate-500">
                  {t('flow.library.stepsCount', { count: Array.isArray(flow.steps) ? flow.steps.length : 0 })}
                </p>
              </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm transition hover:shadow-md"
                  onClick={() => onRun?.(flow)}
                >
                  {t('flow.actions.run')}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 shadow-sm transition hover:shadow-md"
                  onClick={() => onEdit?.(flow)}
                >
                  {t('flow.actions.save')}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                  onClick={() => onDelete?.(flow)}
                >
                  {t('manage.delete.confirm')}
                </button>
            </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
