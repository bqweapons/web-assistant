import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageType, sendMessage } from '../../common/messaging.js';
import { getActiveTab } from '../../common/compat.js';
import { normalizePageUrl } from '../../common/url.js';
import { formatDateTime } from '../../common/i18n.js';
import { ItemList } from './components/ItemList.jsx';
import { OverviewSection } from './components/OverviewSection.jsx';
import { useI18n } from './hooks/useI18n.js';
import { createMessage, formatPreview } from './utils/messages.js';

const initialContextState = { kind: 'message', key: 'context.loading' };

export default function App() {
  const { locale, t, options: localeOptions, setLocale } = useI18n();
  const [pageUrl, setPageUrl] = useState('');
  const [tabId, setTabId] = useState(undefined);
  const [contextInfo, setContextInfo] = useState(initialContextState);
  const [items, setItems] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [creationMessage, setCreationMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [creationType, setCreationType] = useState('button');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingMode, setEditingModeState] = useState(false);
  const importInputRef = useRef(null);
  const editingModeRef = useRef(false);

  useEffect(() => {
    editingModeRef.current = editingMode;
  }, [editingMode]);

  useEffect(() => {
    return () => {
      if (editingModeRef.current && tabId) {
        sendMessage(MessageType.SET_EDIT_MODE, { enabled: false, tabId, pageUrl }).catch(() => {});
      }
    };
  }, [tabId, pageUrl]);

  const typeLabels = useMemo(
    () => ({
      button: t('type.button'),
      link: t('type.link'),
      tooltip: t('type.tooltip'),
      area: t('type.area'),
    }),
    [t],
  );

  const tabs = useMemo(
    () => [
      { id: 'home', label: t('navigation.home') },
      { id: 'overview', label: t('navigation.overview') },
      { id: 'settings', label: t('navigation.settings') },
    ],
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

  const applyTabContext = useCallback(
    (tab) => {
      const normalized = tab?.url ? normalizePageUrl(tab.url) : '';
      if (editingModeRef.current && tabId && (!tab || tab.id !== tabId || (normalized && normalized !== pageUrl))) {
        sendMessage(MessageType.SET_EDIT_MODE, { enabled: false, tabId, pageUrl }).catch(() => {});
        setEditingModeState(false);
      }
      if (tab?.url) {
        setTabId(tab.id);
        setPageUrl((current) => (current === normalized ? current : normalized));
        setContextInfo({ kind: 'url', value: normalized });
      } else {
        setTabId(undefined);
        setPageUrl((current) => (current ? '' : current));
        setContextInfo({ kind: 'message', key: 'context.noActiveTab' });
        setItems([]);
      }
    },
    [pageUrl, tabId],
  );

  const resolveActiveTabContext = useCallback(async () => {
    try {
      const tab = await getActiveTab();
      applyTabContext(tab);
    } catch (error) {
      console.error('Unable to resolve active tab', error);
      setContextInfo({ kind: 'message', key: 'context.resolveError', values: { error: error.message } });
    }
  }, [applyTabContext]);

  useEffect(() => {
    resolveActiveTabContext();
  }, [resolveActiveTabContext]);

  useEffect(() => {
    if (!chrome?.tabs?.onActivated || !chrome?.tabs?.onUpdated) {
      return undefined;
    }

    const handleActivated = async (activeInfo) => {
      if (!activeInfo?.tabId) {
        return;
      }
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        applyTabContext(tab);
      } catch (error) {
        console.warn('Failed to handle tab activation', error);
      }
    };

    const handleUpdated = (nextTabId, changeInfo, tab) => {
      if (!tab?.active || !tab.url) {
        return;
      }
      if (typeof changeInfo.url === 'string' || changeInfo.status === 'complete') {
        applyTabContext(tab);
      }
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, [applyTabContext]);

  useEffect(() => {
    if (!pageUrl) {
      return;
    }
    refreshItems(pageUrl);
  }, [pageUrl, refreshItems]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && tabId && pageUrl) {
        sendMessage(MessageType.CANCEL_PICKER, { tabId, pageUrl }).catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabId, pageUrl]);

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
          break;
        }
        case MessageType.PICKER_CANCELLED:
          if (message.data?.error) {
            setCreationMessage(createMessage('manage.creation.error', { error: message.data.error }));
          } else {
            setCreationMessage(createMessage('manage.picker.cancelled'));
          }
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

  const groupedByPageUrl = useMemo(() => {
    const groups = new Map();
    filteredItems.forEach((item) => {
      const key = (item && item.pageUrl) || pageUrl || '';
      if (!key) {
        return;
      }
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems, pageUrl]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const store = await sendMessage(MessageType.LIST_ALL);
      const serialized = JSON.stringify(store || {}, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `page-augmentor-export-${timestamp}.json`;
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCreationMessage(createMessage('manage.export.success', { filename }));
    } catch (error) {
      console.error('Failed to export elements', error);
      setCreationMessage(createMessage('manage.export.error', { error: error.message }));
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    async (event) => {
      const input = event.target;
      if (!input) {
        return;
      }
      const [file] = input.files || [];
      if (!file) {
        return;
      }
      setImporting(true);
      try {
        const text = await file.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (error) {
          throw new Error('Invalid JSON file');
        }
        const result = await sendMessage(MessageType.IMPORT_STORE, { store: parsed });
        const pages = result?.pageCount ?? 0;
        const elements = result?.elementCount ?? 0;
        setCreationMessage(createMessage('manage.import.success', { pages, elements }));
        await refreshItems(pageUrl);
      } catch (error) {
        console.error('Failed to import elements', error);
        setCreationMessage(createMessage('manage.import.error', { error: error.message }));
      } finally {
        setImporting(false);
        input.value = '';
      }
    },
    [pageUrl, refreshItems],
  );

  const handleStartCreation = useCallback(async () => {
    if (!pageUrl) {
      setCreationMessage(createMessage('context.pageUrlUnavailable'));
      return;
    }
    if (!tabId) {
      setCreationMessage(createMessage('context.tabUnavailable'));
      return;
    }
    try {
      await sendMessage(MessageType.INIT_CREATE, { tabId, pageUrl, type: creationType });
      setCreationMessage(createMessage('manage.creation.started'));
    } catch (error) {
      setCreationMessage(createMessage('manage.creation.error', { error: error.message }));
    }
  }, [creationType, pageUrl, tabId]);

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

  const openPageUrl = useCallback((targetUrl) => {
    if (!targetUrl) {
      return;
    }
    try {
      chrome.tabs.create({ url: targetUrl, active: true });
    } catch (_error) {
      // ignore
    }
  }, []);

  const toggleEditingMode = useCallback(async () => {
    if (!tabId) {
      setCreationMessage(createMessage('context.tabUnavailable'));
      return;
    }
    try {
      await chrome.tabs.update(tabId, { active: true });
    } catch (error) {
      console.warn('Failed to activate tab before toggling edit mode', error);
    }
    const next = !editingMode;
    try {
      await sendMessage(MessageType.SET_EDIT_MODE, { enabled: next, tabId, pageUrl });
      setEditingModeState(next);
      setCreationMessage(createMessage(next ? 'manage.editMode.enabled' : 'manage.editMode.disabled'));
    } catch (error) {
      setCreationMessage(createMessage('manage.editMode.error', { error: error.message }));
    }
  }, [editingMode, pageUrl, tabId]);

  const storeUrl =
    'https://chromewebstore.google.com/detail/page-augmentor/nefpepdpcjejamkgpndlfehkffkfgbpe';

  const handleShareCopy = useCallback(async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(storeUrl);
        setCreationMessage(createMessage('settings.share.copied', { url: storeUrl }));
      } else {
        chrome.tabs.create({ url: storeUrl, active: true });
      }
    } catch (_error) {
      chrome.tabs.create({ url: storeUrl, active: true });
    }
  }, []);

  const handleShareOpen = useCallback(() => {
    try {
      chrome.tabs.create({ url: storeUrl, active: true });
    } catch (_error) {
      // ignore
    }
  }, []);

  const contextLabelText = contextInfo?.kind === 'url' ? contextInfo.value : t(contextInfo.key, contextInfo.values);
  const statusMessageText = creationMessage ? t(creationMessage.key, creationMessage.values) : '';

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-50 p-6">

      <nav className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-brand">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {statusMessageText && (
        <section className="rounded-2xl border border-slate-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 shadow-brand">
          {statusMessageText}
        </section>
      )}

      {activeTab === 'home' && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">{t('manage.sections.add.title')}</h2>
                <p className="text-xs text-slate-500">{t('manage.sections.add.description')}</p>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('manage.sections.add.typeLabel')}
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={creationType}
                    onChange={(event) => setCreationType(event.target.value)}
                  >
                    <option value="button">{t('type.button')}</option>
                    <option value="link">{t('type.link')}</option>
                    <option value="tooltip">{t('type.tooltip')}</option>
                    <option value="area">{t('type.area')}</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
                  onClick={handleStartCreation}
                >
                  {t('manage.actions.addElement')}
                </button>
              </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  aria-pressed={editingMode}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                    editingMode
                      ? 'bg-emerald-500 text-white shadow-lg hover:bg-emerald-600'
                      : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  onClick={toggleEditingMode}
                  disabled={!tabId}
                >
                  {editingMode ? t('manage.actions.editModeDisable') : t('manage.actions.editModeEnable')}
                </button>
                <span className="text-sm text-slate-500">{t('manage.editMode.hint')}</span>
              </div>
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
                <option value="area">{t('manage.sections.filters.options.area')}</option>
              </select>
            </label>
          </section>

          <section className="grid gap-4">
            {groupedByPageUrl.length === 0 ? (
              <ItemList
                items={[]}
                t={t}
                typeLabels={typeLabels}
                formatTimestamp={formatTimestamp}
                formatFrameSummary={formatFrameSummary}
                formatTooltipPosition={formatTooltipPosition}
                formatTooltipMode={formatTooltipMode}
                onFocus={focusElement}
                onOpenEditor={openEditorBubble}
                onDelete={deleteElement}
                showActions
              />
            ) : (
              groupedByPageUrl.map(([groupPageUrl, groupItems]) => (
                <article key={groupPageUrl} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-brand">
                  <header className="flex items-center justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <h3 className="break-all text-sm font-semibold text-slate-900">{groupPageUrl}</h3>
                      <p className="text-xs text-slate-500">
                        {t('overview.pageSummary', { count: groupItems.length })}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="mt-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 md:mt-0"
                      onClick={() => openPageUrl(groupPageUrl)}
                    >
                      {t('overview.openPage')}
                    </button>
                  </header>
                  <ItemList
                    items={groupItems}
                    t={t}
                    typeLabels={typeLabels}
                    formatTimestamp={formatTimestamp}
                    formatFrameSummary={formatFrameSummary}
                    formatTooltipPosition={formatTooltipPosition}
                    formatTooltipMode={formatTooltipMode}
                    onFocus={focusElement}
                    onOpenEditor={openEditorBubble}
                    onDelete={deleteElement}
                    showActions
                  />
                </article>
              ))
            )}
          </section>
        </>
      )}

      {activeTab === 'overview' && (
        <OverviewSection
          t={t}
          typeLabels={typeLabels}
          formatTooltipPosition={formatTooltipPosition}
          formatTooltipMode={formatTooltipMode}
          formatDateTime={formatTimestamp}
          formatFrameSummary={formatFrameSummary}
        />
      )}

      {activeTab === 'settings' && (
        <section className="flex flex-col gap-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
            <h2 className="text-lg font-semibold text-slate-900">{t('settings.heading')}</h2>
            <p className="mt-2 text-sm text-slate-500">{t('settings.description')}</p>
          </article>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
            <header className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">{t('settings.sections.data.title')}</h3>
              <p className="text-sm text-slate-500">{t('settings.sections.data.description')}</p>
            </header>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleImportClick}
                disabled={importing}
              >
                {importing ? t('manage.actions.importing') : t('manage.actions.import')}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? t('manage.actions.exporting') : t('manage.actions.export')}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
            <header className="space-y-2">
              <h3 className="text-base font-semibold text-slate-900">{t('settings.sections.preferences.title')}</h3>
              <p className="text-sm text-slate-500">{t('settings.sections.preferences.description')}</p>
            </header>
            <label className="mt-4 flex max-w-xs flex-col gap-2 text-sm text-slate-700">
              <span>{t('app.language.label')}</span>
              <select
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
            </label>
          </section>
          
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 shadow-brand">
            <header className="space-y-2 text-white">
              <h3 className="text-base font-semibold">
                {t('settings.sections.share.title')}
              </h3>
              <p className="text-sm text-slate-200">
                {t('settings.sections.share.description')}
              </p>
            </header>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleShareCopy}
              >
                {t('settings.actions.shareCopy')}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-400 bg-transparent px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleShareOpen}
              >
                {t('settings.actions.shareOpen')}
              </button>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
