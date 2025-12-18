import React from 'react';
import { summarizeFlow } from '../utils/messages.js';
import { FocusIcon, TrashIcon } from './Icons.jsx';

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
  onOpenFlow,
  onDelete,
  showActions = true,
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-brand">
        {t('manage.empty')}
      </p>
    );
  }

  return (
    <div className="grid auto-rows-fr grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
      {items.map((item) => {
        const frameInfo = formatFrameSummary(item);
        const flowSummary = summarizeFlow(item.actionFlow);

        return (
          <article
            key={item.id}
            className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-brand transition hover:cursor-pointer hover:border-blue-200 hover:shadow-xl"
            onClick={() => onOpenEditor(item.id)}
          >
            <header className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                {typeLabels[item.type] || item.type}
              </span>
              {showActions && onFocus && onDelete && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-blue-600 transition hover:bg-slate-100 hover:text-blue-700"
                    aria-label={t('manage.item.focus')}
                    onClick={(event) => {
                      event.stopPropagation();
                      onFocus(item.id);
                    }}
                  >
                    <FocusIcon className="h-4 w-4" />
                    <span className="sr-only">{t('manage.item.focus')}</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-rose-500 transition hover:bg-slate-100 hover:text-rose-600"
                    aria-label={t('manage.item.delete')}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(item.id);
                    }}
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span className="sr-only">{t('manage.item.delete')}</span>
                  </button>
                  {onOpenFlow && (
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-indigo-600 transition hover:bg-slate-100 hover:text-indigo-700"
                      aria-label={t('manage.item.flow')}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenFlow(item.id);
                      }}
                    >
                      <span className="text-[11px] font-bold">AF</span>
                      <span className="sr-only">{t('manage.item.flow')}</span>
                    </button>
                  )}
                </div>
              )}
            </header>
            <div className="mt-2 flex-1 space-y-1 overflow-hidden text-xs">
              <p className="line-clamp-2 text-sm font-medium text-slate-900">
                {item.text || t('manage.item.noText')}
              </p>
              {item.href && <p className="line-clamp-1 break-all text-[11px] text-blue-600">{item.href}</p>}
              {item.actionSelector && (
                <p className="line-clamp-1 break-all text-[11px] text-emerald-600">
                  {t('manage.item.actionSelector', { selector: item.actionSelector })}
                </p>
              )}
              {flowSummary?.steps ? (
                <p className="line-clamp-1 break-all text-[11px] text-emerald-600">
                  {t('manage.item.actionFlow', { steps: flowSummary.steps })}
                </p>
              ) : null}
              {frameInfo && <p className="line-clamp-1 break-all text-[11px] text-purple-600">{frameInfo}</p>}
              {item.type === 'tooltip' && (
                <p className="line-clamp-1 break-all text-[11px] text-amber-600">
                  {t('manage.item.tooltipDetails', {
                    position: formatTooltipPosition(item.tooltipPosition),
                    mode: formatTooltipMode(item.tooltipPersistent),
                  })}
                </p>
              )}
            </div>
            <footer className="mt-3 flex items-center justify-start text-[11px] text-slate-500">
              <time>{formatTimestamp(item.createdAt)}</time>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
