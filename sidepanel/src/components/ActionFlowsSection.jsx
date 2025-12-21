import React from 'react';
import { PlusIcon, PlayIcon, TrashIcon } from './Icons.jsx';
import { btnIconPrimary, btnIconSecondary, btnIconDanger } from '../styles/buttons.js';

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
          className={btnIconPrimary}
          onClick={onCreate}
          aria-label={t('flow.library.createAction')}
          title={t('flow.library.createAction')}
        >
          <PlusIcon className="h-4 w-4" />
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
              role="button"
              tabIndex={0}
              className="flex h-full cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-brand transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-200"
              onClick={() => onEdit?.(flow)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onEdit?.(flow);
                }
              }}
              aria-label={t('flow.library.editTitle')}
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
                  className={btnIconSecondary}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRun?.(flow);
                  }}
                  aria-label={t('flow.actions.run')}
                  title={t('flow.actions.run')}
                >
                  <PlayIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={btnIconDanger}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete?.(flow);
                  }}
                  aria-label={t('manage.delete.confirm')}
                  title={t('manage.delete.confirm')}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
            </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
