import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageType, sendMessage } from '../../common/messaging.js';
import { getActiveTab } from '../../common/compat.js';
import { parseActionFlowDefinition } from '../../common/flows.js';
import {
  formatDateTime,
  getLocale,
  getLocaleOptions,
  ready as i18nReady,
  setLocale as setGlobalLocale,
  subscribe,
  t as translate,
} from '../../common/i18n.js';

// サイドパネル UI 全体をレンダリングし、コンテンツスクリプトと同期する React エントリーポイント。

const initialContextState = { kind: 'message', key: 'context.loading' };

// i18n キーと置換値をまとめるためのヘルパー。
function createMessage(key, values) {
  return { key, values };
}

/**
 * i18n 状態と翻訳関数を提供するカスタムフック。
 * @returns {{ locale: string; t: (key: string, values?: Record<string, any>) => string; options: { value: string; label: string }[]; setLocale: (locale: string) => void }}
 */
function useI18n() {
  const [locale, setLocaleState] = useState(getLocale());

  useEffect(() => {
    let cancelled = false;
    i18nReady.then((resolved) => {
      if (!cancelled) {
        setLocaleState(resolved);
      }
    });
    const unsubscribe = subscribe((nextLocale) => {
      setLocaleState(nextLocale);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const t = useCallback((key, values) => translate(key, values), [locale]);
  const options = useMemo(() => getLocaleOptions(), [locale]);
  const setLocale = useCallback((nextLocale) => {
    setGlobalLocale(nextLocale);
  }, []);

  return { locale, t, options, setLocale };
}

// サイドパネルのメイン画面を構築するコンテナコンポーネント。
function App() {
  const { locale, t, options: localeOptions, setLocale } = useI18n();
  const [pageUrl, setPageUrl] = useState('');
  const [tabId, setTabId] = useState(undefined);
  const [contextInfo, setContextInfo] = useState(initialContextState);
  const [items, setItems] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [creationMessage, setCreationMessage] = useState(null);
  const [pendingPicker, setPendingPicker] = useState(false);
  const pendingPickerRef = useRef(false);

  const typeLabels = useMemo(
    () => ({
      button: t('type.button'),
      link: t('type.link'),
      tooltip: t('type.tooltip'),
    }),
    [t],
  );

  const formatTooltipPosition = useCallback(
    (position) => {
      const key = position && typeof position === 'string' ? position : 'top';
      return t(`tooltip.position.${key}`);
    },
    [t],
  );

  const formatTooltipMode = useCallback((persistent) => t(persistent ? 'tooltip.mode.persistent' : 'tooltip.mode.hover'), [t]);

  const formatTimestamp = useCallback((timestamp) => formatDateTime(timestamp), [locale]);

  const formatFrameSummary = useCallback(
    (item) => {
      if (!item || !Array.isArray(item.frameSelectors) || item.frameSelectors.length === 0) {
        return '';
      }
      const parts = [];
      if (item.frameLabel) {
        parts.push(item.frameLabel);
      }
      if (item.frameUrl) {
        parts.push(item.frameUrl);
      }
      if (parts.length === 0) {
        parts.push(t('manage.item.frameFallback'));
      }
      return t('manage.item.frameContext', { frame: parts.join(' · ') });
    },
    [t],
  );

  const refreshItems = useCallback(
    async (targetUrl) => {
      const url = targetUrl || pageUrl;
      if (!url) {
        setItems([]);
        return;
      }
      try {
        const list = await sendMessage(MessageType.LIST_BY_URL, { pageUrl: url });
        setItems(Array.isArray(list) ? list : []);
      } catch (error) {
        console.error('Failed to load elements', error);
        setCreationMessage(createMessage('manage.loadError', { error: error.message }));
      }
    },
    [pageUrl],
  );

  useEffect(() => {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (tab?.url) {
          const normalized = normalizeUrl(tab.url);
          setTabId(tab.id);
          setPageUrl(normalized);
          setContextInfo({ kind: 'url', value: normalized });
        } else {
          setContextInfo({ kind: 'message', key: 'context.noActiveTab' });
        }
      } catch (error) {
        console.error('Unable to resolve active tab', error);
        setContextInfo({ kind: 'message', key: 'context.resolveError', values: { error: error.message } });
      }
    })();
  }, []);

  useEffect(() => {
    if (!pageUrl) {
      return;
    }
    refreshItems(pageUrl);
  }, [pageUrl, refreshItems]);

  useEffect(() => {
    const listener = (message) => {
      if (!message?.type) {
        return;
      }
      if (message.pageUrl && message.pageUrl !== pageUrl) {
        return;
      }
      switch (message.type) {
        case MessageType.PICKER_RESULT: {
          if (message.data?.selector) {
            const preview = formatPreview(message.data.preview, t);
            setCreationMessage(
              preview
                ? createMessage('manage.picker.selectedWithPreview', { preview })
                : createMessage('manage.picker.selected'),
            );
          }
          setPendingPicker(false);
          break;
        }
        case MessageType.PICKER_CANCELLED:
          setCreationMessage(createMessage('manage.picker.cancelled'));
          setPendingPicker(false);
          break;
        case MessageType.REHYDRATE:
          setItems(Array.isArray(message.data) ? message.data : []);
          break;
        case MessageType.UPDATE: {
          const updated = message.data;
          if (!updated) {
            break;
          }
          setItems((current) => {
            const index = current.findIndex((item) => item.id === updated.id);
            if (index >= 0) {
              const copy = [...current];
              copy[index] = updated;
              return copy;
            }
            return [...current, updated];
          });
          break;
        }
        case MessageType.DELETE:
          if (message.data?.id) {
            setItems((current) => current.filter((item) => item.id !== message.data.id));
          }
          break;
        default:
          break;
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [pageUrl, t]);

  useEffect(() => {
    pendingPickerRef.current = pendingPicker;
  }, [pendingPicker]);

  useEffect(() => {
    return () => {
      if (pendingPickerRef.current && tabId && pageUrl) {
        sendMessage(MessageType.CANCEL_PICKER, { tabId, pageUrl }).catch(() => {});
      }
    };
  }, [pageUrl, tabId]);

  const filteredItems = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    return items
      .filter((item) => {
        const matchesType = filterType === 'all' || item.type === filterType;
        if (!matchesType) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          item.text.toLowerCase().includes(query) ||
          item.selector.toLowerCase().includes(query) ||
          (item.href || '').toLowerCase().includes(query) ||
          (item.frameLabel || '').toLowerCase().includes(query) ||
          (item.frameUrl || '').toLowerCase().includes(query)
        );
      })
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [filterText, filterType, items]);

  const handleStartCreation = useCallback(async () => {
    if (pendingPicker) {
      await cancelActivePicker();
    }
    if (!pageUrl) {
      setCreationMessage(createMessage('context.pageUrlUnavailable'));
      return;
    }
    if (!tabId) {
      setCreationMessage(createMessage('context.tabUnavailable'));
      return;
    }
    setPendingPicker(true);
    setCreationMessage(createMessage('manage.picker.instructions'));
    try {
      await sendMessage(MessageType.START_PICKER, { tabId, pageUrl, mode: 'create' });
    } catch (error) {
      setPendingPicker(false);
      setCreationMessage(createMessage('manage.picker.startError', { error: error.message }));
    }
  }, [pendingPicker, pageUrl, tabId]);

  const cancelActivePicker = useCallback(async () => {
    if (!pendingPicker || !tabId || !pageUrl) {
      return;
    }
    setPendingPicker(false);
    try {
      await sendMessage(MessageType.CANCEL_PICKER, { tabId, pageUrl });
    } catch (error) {
      console.warn('Failed to cancel picker', error);
    }
  }, [pendingPicker, tabId, pageUrl]);

  const focusElement = useCallback(
    async (id) => {
      if (!tabId || !pageUrl) {
        setCreationMessage(createMessage('context.focusRequiresActivation'));
        return;
      }
      try {
        await chrome.tabs.update(tabId, { active: true });
        await sendMessage(MessageType.FOCUS_ELEMENT, { id, tabId, pageUrl });
      } catch (error) {
        setCreationMessage(createMessage('manage.focusError', { error: error.message }));
      }
    },
    [tabId, pageUrl],
  );

  const deleteElement = useCallback(
    async (id) => {
      if (!window.confirm(t('manage.delete.confirm'))) {
        return;
      }
      try {
        const list = await sendMessage(MessageType.DELETE, { id, pageUrl });
        setItems(Array.isArray(list) ? list : []);
        setCreationMessage(createMessage('manage.delete.success'));
      } catch (error) {
        setCreationMessage(createMessage('manage.delete.error', { error: error.message }));
      }
    },
    [pageUrl, t],
  );

  const openEditorBubble = useCallback(
    async (id) => {
      if (!pageUrl) {
        setCreationMessage(createMessage('context.pageUrlUnavailable'));
        return;
      }
      if (!tabId) {
        setCreationMessage(createMessage('context.tabUnavailable'));
        return;
      }
      try {
        await chrome.tabs.update(tabId, { active: true });
        await sendMessage(MessageType.OPEN_EDITOR, { id, pageUrl, tabId });
        setCreationMessage(createMessage('manage.openBubble.success'));
      } catch (error) {
        setCreationMessage(createMessage('manage.openBubble.error', { error: error.message }));
      }
    },
    [pageUrl, tabId],
  );

  const contextLabelText = contextInfo?.kind === 'url' ? contextInfo.value : t(contextInfo.key, contextInfo.values);
  const creationMessageText = creationMessage ? t(creationMessage.key, creationMessage.values) : '';

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-50 p-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-brand sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">{t('app.title')}</h1>
          <p className="text-sm text-slate-500">{t('app.subtitle')}</p>
          <p className="text-xs text-slate-400">{contextLabelText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="page-augmentor-language">
            {t('app.language.label')}
          </label>
          <select
            id="page-augmentor-language"
            className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            {localeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('manage.sections.add.title')}</h2>
            <p className="text-xs text-slate-500">{t('manage.sections.add.description')}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleStartCreation}
              disabled={pendingPicker}
            >
              {pendingPicker ? t('manage.actions.picking') : t('manage.actions.pick')}
            </button>
            {pendingPicker && (
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                onClick={cancelActivePicker}
              >
                {t('manage.actions.cancel')}
              </button>
            )}
          </div>
        </div>
        {creationMessageText && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-xs text-slate-600">
            {creationMessageText}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-brand md:flex-row md:items-end md:justify-between">
        <label className="flex w-full flex-col gap-2 text-sm text-slate-700 md:max-w-md">
          {t('manage.sections.filters.searchLabel')}
          <input
            className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            type="search"
            placeholder={t('manage.sections.filters.searchPlaceholder')}
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-700 md:w-48">
          {t('manage.sections.filters.filterLabel')}
          <select
            className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="all">{t('manage.sections.filters.options.all')}</option>
            <option value="button">{t('manage.sections.filters.options.button')}</option>
            <option value="link">{t('manage.sections.filters.options.link')}</option>
            <option value="tooltip">{t('manage.sections.filters.options.tooltip')}</option>
          </select>
        </label>
      </section>

      <section className="grid gap-4">
        {filteredItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-brand">
            {t('manage.empty')}
          </p>
        ) : (
          filteredItems.map((item) => {
            const frameInfo = formatFrameSummary(item);
            const flowSummary = summarizeFlow(item.actionFlow);
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand transition hover:cursor-pointer hover:border-blue-200 hover:shadow-xl"
                onClick={() => openEditorBubble(item.id)}
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
                      focusElement(item.id);
                    }}
                  >
                    {t('manage.item.focus')}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditorBubble(item.id);
                    }}
                  >
                    {t('manage.item.openBubble')}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteElement(item.id);
                    }}
                  >
                    {t('manage.item.delete')}
                  </button>
                </footer>
              </article>
            );
          })
        )}
      </section>

      <OverviewSection
        t={t}
        typeLabels={typeLabels}
        formatTooltipPosition={formatTooltipPosition}
        formatTooltipMode={formatTooltipMode}
        formatDateTime={formatTimestamp}
        formatFrameSummary={formatFrameSummary}
      />
    </main>
  );
}

// 保存済み全ページの一覧を表示する概要セクション。
function OverviewSection({ t, typeLabels, formatTooltipPosition, formatTooltipMode, formatDateTime, formatFrameSummary }) {
  const [store, setStore] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const entries = useMemo(() => Object.entries(store).sort(([a], [b]) => a.localeCompare(b)), [store]);
  const totalElements = entries.reduce((total, [, items]) => total + (items?.length || 0), 0);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-brand">
          <span className="text-sm font-medium text-slate-500">{t('overview.pageCount.label')}</span>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{entries.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-brand">
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

/**
 * ピッカーで選択した要素の概要テキストを整形する。
 * @param {{ tag?: string; classes?: string; text?: string } | null} preview
 * @param {(key: string, values?: Record<string, any>) => string} t
 * @returns {string}
 */
function formatPreview(preview, t) {
  if (!preview) {
    return t('picker.previewTarget');
  }
  const parts = [];
  if (preview.tag) {
    parts.push(preview.tag);
  }
  if (preview.classes) {
    parts.push(`.${preview.classes}`);
  }
  if (preview.text) {
    parts.push(`"${preview.text}"`);
  }
  return parts.length > 0 ? parts.join(' ') : t('picker.previewTarget');
}

/**
 * アクションフロー文字列からステップ数を取得する。
 * @param {string | undefined} actionFlow
 * @returns {{ steps: number } | null}
 */
function summarizeFlow(actionFlow) {
  if (typeof actionFlow !== 'string') {
    return null;
  }
  const trimmed = actionFlow.trim();
  if (!trimmed) {
    return null;
  }
  const { definition, error } = parseActionFlowDefinition(trimmed);
  if (error || !definition) {
    return null;
  }
  return { steps: definition.stepCount };
}

/**
 * URL を正規化して比較可能な形へ変換する。
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  try {
    const target = new URL(url);
    return `${target.origin}${target.pathname}${target.search}`;
  } catch (error) {
    return url;
  }
}

/**
 * 指定ページ URL と一致するタブを検索する。
 * @param {string} pageUrl
 * @returns {Promise<chrome.tabs.Tab | undefined>}
 */
async function findTabByPageUrl(pageUrl) {
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => tab.url && normalizeUrl(tab.url) === pageUrl);
}

/**
 * ページ URL に対応するタブをアクティブ化し、存在しない場合は新規作成する。
 * @param {string} pageUrl
 * @returns {Promise<chrome.tabs.Tab>}
 */
async function ensureTab(pageUrl) {
  const existing = await findTabByPageUrl(pageUrl);
  if (existing) {
    return existing;
  }
  return chrome.tabs.create({ url: pageUrl, active: true });
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
