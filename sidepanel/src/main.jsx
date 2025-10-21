import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageType, sendMessage } from '../../common/messaging.js';
import { getActiveTab } from '../../common/compat.js';

const defaultCreatorMessage = '';

function App() {
  const [pageUrl, setPageUrl] = useState('');
  const [tabId, setTabId] = useState(undefined);
  const [contextLabel, setContextLabel] = useState('Loading active page...');
  const [items, setItems] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [creationMessage, setCreationMessage] = useState(defaultCreatorMessage);
  const [pendingPicker, setPendingPicker] = useState(false);
  const [activeView, setActiveView] = useState('manage');
  const pendingPickerRef = useRef(false);

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
        setCreationMessage(`Failed to load items: ${error.message}`);
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
          setContextLabel(normalized);
        } else {
          setContextLabel('No active tab detected');
        }
      } catch (error) {
        console.error('Unable to resolve active tab', error);
        setContextLabel(`Failed to read active tab: ${error.message}`);
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
            const preview = formatPreview(message.data.preview);
            setCreationMessage(preview ? `Selected ${preview}` : 'Target selected');
          }
          setPendingPicker(false);
          break;
        }
        case MessageType.PICKER_CANCELLED:
          setCreationMessage('Picker cancelled');
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
  }, [pageUrl, pendingPicker]);

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
          (item.href || '').toLowerCase().includes(query)
        );
      })
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [filterText, filterType, items]);
  const handleStartCreation = async () => {
    if (pendingPicker) {
      await cancelActivePicker();
    }
    if (!pageUrl) {
      setCreationMessage('Active page URL not available yet');
      return;
    }
    if (!tabId) {
      setCreationMessage('Unable to locate the active tab');
      return;
    }
    setPendingPicker(true);
    setCreationMessage('Click on the page to pick a target element');
    try {
      await sendMessage(MessageType.START_PICKER, { tabId, pageUrl, mode: 'create' });
    } catch (error) {
      setPendingPicker(false);
      setCreationMessage(`Failed to start picker: ${error.message}`);
    }
  };

  const cancelActivePicker = async () => {
    if (!pendingPicker || !tabId || !pageUrl) {
      return;
    }
    setPendingPicker(false);
    try {
      await sendMessage(MessageType.CANCEL_PICKER, { tabId, pageUrl });
    } catch (error) {
      console.warn('Failed to cancel picker', error);
    }
  };

  const focusElement = async (id) => {
    if (!tabId || !pageUrl) {
      setCreationMessage('Activate the tab before focusing an element');
      return;
    }
    try {
      await chrome.tabs.update(tabId, { active: true });
      await sendMessage(MessageType.FOCUS_ELEMENT, { id, tabId, pageUrl });
    } catch (error) {
      setCreationMessage(`Unable to focus element: ${error.message}`);
    }
  };

  const deleteElement = async (id) => {
    if (!window.confirm('Remove this element?')) {
      return;
    }
    try {
      const list = await sendMessage(MessageType.DELETE, { id, pageUrl });
      setItems(Array.isArray(list) ? list : []);
      setCreationMessage('Element removed');
    } catch (error) {
      setCreationMessage(`Failed to delete element: ${error.message}`);
    }
  };

  const openEditorBubble = async (id) => {
    if (!pageUrl) {
      setCreationMessage('Active page URL not available yet');
      return;
    }
    if (!tabId) {
      setCreationMessage('Unable to locate the active tab');
      return;
    }
    try {
      await chrome.tabs.update(tabId, { active: true });
      await sendMessage(MessageType.OPEN_EDITOR, { id, pageUrl, tabId });
      setCreationMessage('Bubble editor opened on the page');
    } catch (error) {
      setCreationMessage(`Failed to open bubble: ${error.message}`);
    }
  };

  const handleSwitchView = async (view) => {
    if (view === activeView) {
      return;
    }
    if (pendingPicker) {
      await cancelActivePicker();
    }
    setActiveView(view);
  };

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-slate-50 p-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-brand sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Page Augmentor</h1>
          <p className="text-sm text-slate-500">
            {activeView === 'manage' ? contextLabel : 'Review every injected element across all pages.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-lg transition ${
              activeView === 'manage'
                ? 'bg-gradient-to-r from-brand-start to-brand-end text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
            onClick={() => handleSwitchView('manage')}
          >
            元素管理
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold shadow-lg transition ${
              activeView === 'overview'
                ? 'bg-gradient-to-r from-brand-start to-brand-end text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
            onClick={() => handleSwitchView('overview')}
          >
            全局一?
          </button>
        </div>
      </header>
      {activeView === 'manage' ? (
        <>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add element</h2>
            <p className="text-xs text-slate-500">Pick a target element to open the in-page bubble editor.</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleStartCreation}
              disabled={pendingPicker}
            >
              {pendingPicker ? 'Picking...' : 'Pick target'}
            </button>
            {pendingPicker && (
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                onClick={cancelActivePicker}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        {creationMessage && (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-xs text-slate-600">
            {creationMessage}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-brand md:flex-row md:items-end md:justify-between">
        <label className="flex w-full flex-col gap-2 text-sm text-slate-700 md:max-w-md">
          Search
          <input
            className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            type="search"
            placeholder="Filter by text, selector or url"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-700 md:w-48">
          Type filter
          <select
            className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="all">All</option>
            <option value="button">Button</option>
            <option value="link">Link</option>
          </select>
        </label>
      </section>

      <section className="grid gap-4">
        {filteredItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-brand">
            No elements match your filters.
          </p>
        ) : (
          filteredItems.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand transition hover:border-blue-200 hover:shadow-xl hover:cursor-pointer"
              onClick={() => openEditorBubble(item.id)}
            >
              <header className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  {item.type}
                </span>
                <time className="text-xs text-slate-500">{formatDate(item.createdAt)}</time>
              </header>
              <p className="mt-3 text-base font-medium text-slate-900">{item.text || '(empty text)'}</p>
              <p className="mt-2 break-all text-xs text-slate-500">{item.selector}</p>
              {item.href && (
                <p className="mt-1 break-all text-xs text-blue-600">{item.href}</p>
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
                  Focus
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditorBubble(item.id);
                  }}
                >
                  Open bubble
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteElement(item.id);
                  }}
                >
                  Delete
                </button>
              </footer>
            </article>
          ))
        )}
      </section>

        </>
      ) : (
        <OverviewView onOpenManage={() => handleSwitchView('manage')} />
      )}
    </main>
  );
}

function OverviewView({ onOpenManage }) {
  const [store, setStore] = useState({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const entries = useMemo(() => Object.entries(store).sort(([a], [b]) => a.localeCompare(b)), [store]);
  const totalElements = entries.reduce((total, [, items]) => total + (items?.length || 0), 0);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setStatus('');
    try {
      const data = await sendMessage(MessageType.LIST_ALL);
      setStore(data || {});
    } catch (error) {
      console.error('Failed to load overview', error);
      setStatus(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const updatePage = (pageUrl, list) => {
    setStore((prev) => {
      const next = { ...prev };
      if (!list || list.length === 0) {
        delete next[pageUrl];
      } else {
        next[pageUrl] = list;
      }
      return next;
    });
  };

  const handleOpenPage = (pageUrl) => {
    chrome.tabs.create({ url: pageUrl });
  };

  const handleClearPage = async (pageUrl) => {
    if (!window.confirm('Remove all elements on this page?')) {
      return;
    }
    try {
      await sendMessage(MessageType.CLEAR_PAGE, { pageUrl });
      updatePage(pageUrl, []);
      setStatus('Page cleared');
    } catch (error) {
      setStatus(`Failed to clear page: ${error.message}`);
    }
  };

  const handleDeleteItem = async (pageUrl, id) => {
    if (!window.confirm('Delete this element?')) {
      return;
    }
    try {
      const list = await sendMessage(MessageType.DELETE, { pageUrl, id });
      updatePage(pageUrl, list);
      setStatus('Element removed');
    } catch (error) {
      setStatus(`Failed to delete element: ${error.message}`);
    }
  };

  const handleFocusItem = async (pageUrl, id) => {
    const tab = await findTabByPageUrl(pageUrl);
    if (!tab?.id) {
      const created = await chrome.tabs.create({ url: pageUrl });
      alert('Opened a new tab. Please open the side panel manually and try again.');
      return created;
    }
    await chrome.tabs.update(tab.id, { active: true });
    try {
      await sendMessage(MessageType.FOCUS_ELEMENT, { pageUrl, id, tabId: tab.id });
    } catch (error) {
      alert(`Failed to focus element: ${error.message}`);
    }
  };

  const handleEditItem = async (pageUrl, id) => {
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
      if (typeof onOpenManage === 'function') {
        onOpenManage();
      }
    } catch (error) {
      alert(`Failed to open bubble editor: ${error.message}`);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
          <span className="text-sm font-medium text-slate-500">Pages</span>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{entries.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
          <span className="text-sm font-medium text-slate-500">Elements</span>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalElements}</p>
        </article>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-start to-brand-end px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        {status && (
          <p className="rounded-xl border border-slate-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 shadow-brand">
            {status}
          </p>
        )}
      </div>

      <section className="grid gap-6">
        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-brand">
            No pages have stored elements yet.
          </p>
        ) : (
          entries.map(([pageUrl, items]) => (
            <article key={pageUrl} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
              <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <h2 className="break-all text-base font-semibold text-slate-900">{pageUrl}</h2>
                  <p className="text-xs text-slate-500">{items.length} element(s)</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    onClick={() => handleOpenPage(pageUrl)}
                  >
                    Open page
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                    onClick={() => handleClearPage(pageUrl)}
                  >
                    Clear page
                  </button>
                </div>
              </header>
              <ul className="mt-4 grid gap-4">
                {items
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((item) => (
                    <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                          {item.type}
                        </span>
                        <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{item.text || '(empty text)'}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{item.selector}</p>
                      {item.href && (
                        <p className="mt-1 break-all text-xs text-blue-600">{item.href}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                          onClick={() => handleFocusItem(pageUrl, item.id)}
                        >
                          Focus
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                          onClick={() => handleEditItem(pageUrl, item.id)}
                        >
                          Open bubble
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                          onClick={() => handleDeleteItem(pageUrl, item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            </article>
          ))
        )}
      </section>
    </section>
  );
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatPreview(preview) {
  if (!preview) {
    return 'target element';
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
  return parts.join(' ');
}

function normalizeUrl(url) {
  try {
    const target = new URL(url);
    return `${target.origin}${target.pathname}${target.search}`;
  } catch (error) {
    return url;
  }
}

async function findTabByPageUrl(pageUrl) {
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => tab.url && normalizeUrl(tab.url) === pageUrl);
}

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


