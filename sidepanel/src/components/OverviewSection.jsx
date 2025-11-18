import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageType, sendMessage } from '../../../common/messaging.js';
import { createMessage } from '../utils/messages.js';
import { ensureTab, findTabByPageUrl } from '../utils/tabs.js';
import { ItemList } from './ItemList.jsx';
import { RefreshIcon, ClearPageIcon } from './Icons.jsx';

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
  const [expandedSites, setExpandedSites] = useState(() => new Set());

  const siteGroups = useMemo(() => {
    /** @type {Array<{ siteKey: string; pages: Array<{ pageUrl: string; items: any[] }> }>} */
    const result = [];
    const siteMap = new Map();
    Object.entries(store || {}).forEach(([siteKey, items]) => {
      const pageMap = siteMap.get(siteKey) || new Map();
      if (!siteMap.has(siteKey)) {
        siteMap.set(siteKey, pageMap);
      }
      (items || []).forEach((item) => {
        if (!item) return;
        const pageUrl = item.pageUrl || siteKey;
        if (!pageMap.has(pageUrl)) {
          pageMap.set(pageUrl, []);
        }
        pageMap.get(pageUrl).push(item);
      });
    });
    Array.from(siteMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([siteKey, pageMap]) => {
        const pages = Array.from(pageMap.entries())
          .map(([pageUrl, items]) => ({
            pageUrl,
            items: items.slice().sort((a, b) => b.createdAt - a.createdAt),
          }))
          .sort((a, b) => a.pageUrl.localeCompare(b.pageUrl));
        result.push({ siteKey, pages });
      });
    return result;
  }, [store]);

  const totalElements = siteGroups.reduce(
    (total, site) => total + site.pages.reduce((inner, page) => inner + page.items.length, 0),
    0,
  );
  const totalPages = siteGroups.reduce((total, site) => total + site.pages.length, 0);

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
  const isSiteCollapsed = useCallback(
    (siteKey) => !expandedSites.has(siteKey),
    [expandedSites],
  );
  const toggleSiteCollapsed = useCallback((siteKey) => {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(siteKey)) {
        next.delete(siteKey);
      } else {
        next.add(siteKey);
      }
      return next;
    });
  }, []);

  return (
    <>
      <section className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">{t('overview.heading')}</h2>
          <p className="text-xs text-slate-500">{t('overview.description')}</p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={refresh}
          disabled={loading}
          aria-label={loading ? t('overview.refreshing') : t('overview.refresh')}
        >
          <RefreshIcon className="h-4 w-4" />
        </button>
      </section>

      <section className="mt-4 flex flex-col gap-6">
        {statusMessage && (
          <p className="rounded-xl border border-slate-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 shadow-brand">
            {statusMessage}
          </p>
        )}
        <section className="flex gap-4">
          <article className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-brand">
            <span className="text-sm font-medium text-slate-500">{t('overview.pageCount.label')}</span>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{totalPages}</p>
          </article>
          <article className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-brand">
            <span className="text-sm font-medium text-slate-500">{t('overview.elementCount.label')}</span>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{totalElements}</p>
          </article>
        </section>
        <section className="grid gap-6">
          {siteGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-brand">
              {t('overview.empty')}
            </p>
          ) : (
          siteGroups.map(({ siteKey, pages }) => {
            const collapsed = isSiteCollapsed(siteKey);
            const siteElementCount = pages.reduce((sum, page) => sum + page.items.length, 0);
            return (
              <article key={siteKey} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-start gap-3">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      onClick={() => toggleSiteCollapsed(siteKey)}
                      aria-label={collapsed ? t('overview.expandPage') : t('overview.collapsePage')}
                    >
                      <span className="text-base leading-none">{collapsed ? '▸' : '▾'}</span>
                    </button>
                    <div className="min-w-0 space-y-1">
                      <h3
                        className="break-all text-base font-semibold text-slate-900 cursor-pointer hover:underline"
                        onClick={() => handleOpenPage(siteKey)}
                      >
                        {siteKey}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t('overview.pageSummary', { count: siteElementCount })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-shrink-0 items-center gap-2 md:mt-0">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-rose-500 transition hover:bg-slate-100 hover:text-rose-600"
                      onClick={() => handleClearPage(siteKey)}
                      aria-label={t('overview.clearPage')}
                      title={t('overview.clearPage')}
                    >
                      <ClearPageIcon className="h-4 w-4" />
                    </button>
                  </div>
                </header>
                {!collapsed && (
                  <div className="mt-4 grid gap-4">
                    {pages.map(({ pageUrl, items }) => (
                      <section key={pageUrl} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <header className="flex items-center justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <h4
                              className="break-all text-sm font-semibold text-slate-900 cursor-pointer hover:underline"
                              onClick={() => handleOpenPage(pageUrl)}
                            >
                              {pageUrl}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {t('overview.pageSummary', { count: items.length })}
                            </p>
                          </div>
                        </header>
                        <ItemList
                          items={items}
                          t={t}
                          typeLabels={typeLabels}
                          formatTimestamp={formatDateTime}
                          formatFrameSummary={formatFrameSummary}
                          formatTooltipPosition={formatTooltipPosition}
                          formatTooltipMode={formatTooltipMode}
                          onFocus={(id) => handleFocusItem(siteKey, id)}
                          onOpenEditor={(id) => handleEditItem(siteKey, id)}
                          onDelete={(id) => handleDeleteItem(siteKey, id)}
                          showActions={false}
                        />
                      </section>
                    ))}
                  </div>
                )}
              </article>
            );
          })
          )}
        </section>
      </section>
    </>
  );
}
