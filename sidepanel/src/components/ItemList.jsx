import React from 'react';
import { summarizeFlow } from '../utils/messages.js';

export function ItemList({
  items,
  t,
  typeLabels,
  formatTimestamp,
  formatFrameSummary,
  formatTooltipPosition,
  formatTooltipMode,
  onFocus,
  onOpenEditor,
  onDelete,
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-brand">
        {t('manage.empty')}
      </p>
    );
  }

  return items.map((item) => {
    const frameInfo = formatFrameSummary(item);
    const flowSummary = summarizeFlow(item.actionFlow);

    return (
      <article
        key={item.id}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand transition hover:cursor-pointer hover:border-blue-200 hover:shadow-xl"
        onClick={() => onOpenEditor(item.id)}
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            {typeLabels[item.type] || item.type}
          </span>
          <time className="text-xs text-slate-500">{formatTimestamp(item.createdAt)}</time>
        </header>
        <p className="mt-3 text-base font-medium text-slate-900">{item.text || t('manage.item.noText')}</p>
        <p className="mt-2 break-all text-xs text-slate-500">{item.selector}</p>
        {item.href && <p className="mt-1 break-all text-xs text-blue-600">{item.href}</p>}
        {item.actionSelector && (
          <p className="mt-1 break-all text-xs text-emerald-600">
            {t('manage.item.actionSelector', { selector: item.actionSelector })}
          </p>
        )}
        {flowSummary?.steps ? (
          <p className="mt-1 break-all text-xs text-emerald-600">
            {t('manage.item.actionFlow', { steps: flowSummary.steps })}
          </p>
        ) : null}
        {frameInfo && <p className="mt-1 break-all text-xs text-purple-600">{frameInfo}</p>}
        {item.type === 'tooltip' && (
          <p className="mt-1 break-all text-xs text-amber-600">
            {t('manage.item.tooltipDetails', {
              position: formatTooltipPosition(item.tooltipPosition),
              mode: formatTooltipMode(item.tooltipPersistent),
            })}
          </p>
        )}
        <footer className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
            onClick={(event) => {
              event.stopPropagation();
              onFocus(item.id);
            }}
          >
            {t('manage.item.focus')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            onClick={(event) => {
              event.stopPropagation();
              onOpenEditor(item.id);
            }}
          >
            {t('manage.item.openBubble')}
          </button>
          <button
            type="button"
            className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item.id);
            }}
          >
            {t('manage.item.delete')}
          </button>
        </footer>
      </article>
    );
  });
}
