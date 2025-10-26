import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageType, sendMessage } from '../../../common/messaging.js';
import { createMessage, summarizeFlow } from '../utils/messages.js';
import { ensureTab, findTabByPageUrl } from '../utils/tabs.js';

export function OverviewSection({
  t,
  typeLabels,
  formatTooltipPosition,
  formatTooltipMode,
  formatDateTime,
  formatFrameSummary,
}) {
  const [store, setStore] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const entries = useMemo(() => Object.entries(store).sort(([a], [b]) => a.localeCompare(b)), [store]);
  const totalElements = entries.reduce((total, [, items]) => total + (items?.length || 0), 0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const data = await sendMessage(MessageType.LIST_ALL);
      setStore(data || {});
    } catch (error) {
      console.error('Failed to load overview', error);
      setStatus(createMessage('overview.statusLoadError', { error: error.message }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updatePage = useCallback((pageUrl, list) => {
    setStore((prev) => {
      const next = { ...prev };
      if (!list || list.length === 0) {
        delete next[pageUrl];
      } else {
        next[pageUrl] = list;
      }
      return next;
    });
  }, []);

  const handleOpenPage = useCallback((pageUrl) => {
    chrome.tabs.create({ url: pageUrl });
  }, []);

  const handleClearPage = useCallback(
    async (pageUrl) => {
      if (!window.confirm(t('overview.clearConfirm'))) {
        return;
      }
      try {
        await sendMessage(MessageType.CLEAR_PAGE, { pageUrl });
        updatePage(pageUrl, []);
        setStatus(createMessage('overview.clearSuccess'));
      } catch (error) {
        setStatus(createMessage('overview.clearError', { error: error.message }));
      }
    },
    [t, updatePage],
  );

  const handleDeleteItem = useCallback(
    async (pageUrl, id) => {
      if (!window.confirm(t('overview.deleteConfirm'))) {
        return;
      }
      try {
        const list = await sendMessage(MessageType.DELETE, { pageUrl, id });
        updatePage(pageUrl, list);
        setStatus(createMessage('overview.deleteSuccess'));
      } catch (error) {
        setStatus(createMessage('overview.deleteError', { error: error.message }));
      }
    },
    [t, updatePage],
  );

  const handleFocusItem = useCallback(
    async (pageUrl, id) => {
      const tab = await findTabByPageUrl(pageUrl);
      if (!tab?.id) {
        const created = await chrome.tabs.create({ url: pageUrl });
        alert(t('overview.openedNewTab'));
        return created;
      }
      await chrome.tabs.update(tab.id, { active: true });
      try {
        await sendMessage(MessageType.FOCUS_ELEMENT, { pageUrl, id, tabId: tab.id });
      } catch (error) {
        alert(t('overview.focusError', { error: error.message }));
      }
    },
    [t],
  );

  const handleEditItem = useCallback(
    async (pageUrl, id) => {
      const tab = await ensureTab(pageUrl);
      if (!tab?.id) {
        return;
      }
      await chrome.tabs.update(tab.id, { active: true });
      if (chrome.sidePanel?.open) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
      try {
        await sendMessage(MessageType.OPEN_EDITOR, { pageUrl, id, tabId: tab.id });
      } catch (error) {
        alert(t('overview.openBubbleError', { error: error.message }));
      }
    },
    [t],
  );

  const statusMessage = status ? t(status.key, status.values) : '';

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{t('overview.heading')}</h2>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-start to-brand-end px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? t('overview.refreshing') : t('overview.refresh')}
        </button>
      </div>
      {statusMessage && (
        <p className="rounded-xl border border-slate-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 shadow-brand">{statusMessage}</p>
      )}
      <section className="flex gap-4">
        <article className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-brand">
          <span className="text-sm font-medium text-slate-500">{t('overview.pageCount.label')}</span>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{entries.length}</p>
        </article>
        <article className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-brand">
          <span className="text-sm font-medium text-slate-500">{t('overview.elementCount.label')}</span>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalElements}</p>
        </article>
      </section>
      <section className="grid gap-6">
        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-brand">
            {t('overview.empty')}
          </p>
        ) : (
          entries.map(([pageUrl, items]) => (
            <article key={pageUrl} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
              <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <h3 className="break-all text-base font-semibold text-slate-900">{pageUrl}</h3>
                  <p className="text-xs text-slate-500">{t('overview.pageSummary', { count: items.length })}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    onClick={() => handleOpenPage(pageUrl)}
                  >
                    {t('overview.openPage')}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                    onClick={() => handleClearPage(pageUrl)}
                  >
                    {t('overview.clearPage')}
                  </button>
                </div>
              </header>
              <ul className="mt-4 grid gap-4">
                {items
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((item) => {
                    const frameInfo = formatFrameSummary(item);
                    const flowSummary = summarizeFlow(item.actionFlow);
                    return (
                      <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                            {typeLabels[item.type] || item.type}
                          </span>
                          <span className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-slate-900">{item.text || t('manage.item.noText')}</p>
                        <p className="mt-1 break-all text-xs text-slate-500">{item.selector}</p>
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
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                            onClick={() => handleFocusItem(pageUrl, item.id)}
                          >
                            {t('manage.item.focus')}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                            onClick={() => handleEditItem(pageUrl, item.id)}
                          >
                            {t('manage.item.openBubble')}
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                            onClick={() => handleDeleteItem(pageUrl, item.id)}
                          >
                            {t('manage.item.delete')}
                          </button>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </article>
          ))
        )}
      </section>
    </section>
  );
}
