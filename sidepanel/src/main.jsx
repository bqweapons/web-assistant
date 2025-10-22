import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageType, sendMessage } from '../../common/messaging.js';
import { getActiveTab } from '../../common/compat.js';

const defaultCreatorMessage = '';

function App() {
  const [pageUrl, setPageUrl] = useState('');
  const [tabId, setTabId] = useState(undefined);
  const [contextLabel, setContextLabel] = useState('アクティブなページを読み込み中...');
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
        setCreationMessage(`要素を読み込めませんでした: ${error.message}`);
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
          setContextLabel('アクティブなタブが見つかりません');
        }
      } catch (error) {
        console.error('Unable to resolve active tab', error);
        setContextLabel(`アクティブなタブを取得できません: ${error.message}`);
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
            setCreationMessage(preview ? `${preview} を選択しました` : 'ターゲットを選択しました');
          }
          setPendingPicker(false);
          break;
        }
        case MessageType.PICKER_CANCELLED:
          setCreationMessage('選択をキャンセルしました');
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
      setCreationMessage('ページのURLがまだ利用できません');
      return;
    }
    if (!tabId) {
      setCreationMessage('アクティブなタブを特定できません');
      return;
    }
    setPendingPicker(true);
    setCreationMessage('ページ上をクリックしてターゲット要素を選択してください');
    try {
      await sendMessage(MessageType.START_PICKER, { tabId, pageUrl, mode: 'create' });
    } catch (error) {
      setPendingPicker(false);
      setCreationMessage(`要素選択を開始できません: ${error.message}`);
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
      setCreationMessage('要素をフォーカスする前にタブをアクティブにしてください');
      return;
    }
    try {
      await chrome.tabs.update(tabId, { active: true });
      await sendMessage(MessageType.FOCUS_ELEMENT, { id, tabId, pageUrl });
    } catch (error) {
      setCreationMessage(`要素をフォーカスできません: ${error.message}`);
    }
  };

  const deleteElement = async (id) => {
    if (!window.confirm('この要素を削除しますか？')) {
      return;
    }
    try {
      const list = await sendMessage(MessageType.DELETE, { id, pageUrl });
      setItems(Array.isArray(list) ? list : []);
      setCreationMessage('要素を削除しました');
    } catch (error) {
      setCreationMessage(`要素を削除できません: ${error.message}`);
    }
  };

  const openEditorBubble = async (id) => {
    if (!pageUrl) {
      setCreationMessage('ページのURLがまだ利用できません');
      return;
    }
    if (!tabId) {
      setCreationMessage('アクティブなタブを特定できません');
      return;
    }
    try {
      await chrome.tabs.update(tabId, { active: true });
      await sendMessage(MessageType.OPEN_EDITOR, { id, pageUrl, tabId });
      setCreationMessage('バブルエディターをページに表示しました');
    } catch (error) {
      setCreationMessage(`バブルを開けませんでした: ${error.message}`);
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
            要素管理
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
            要素一覧
          </button>
        </div>
      </header>
      {activeView === 'manage' ? (
        <>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">要素を追加</h2>
            <p className="text-xs text-slate-500">ページ内でターゲット要素を選択すると、バブルエディターが開きます。</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleStartCreation}
              disabled={pendingPicker}
            >
              {pendingPicker ? '選択中...' : 'ターゲットを選択'}
            </button>
            {pendingPicker && (
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                onClick={cancelActivePicker}
              >
                キャンセル
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
          検索
          <input
            className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            type="search"
            placeholder="テキスト・セレクター・URLでフィルター"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-700 md:w-48">
          フィルター
          <select
            className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="all">すべて</option>
            <option value="button">ボタン</option>
            <option value="link">リンク</option>
          </select>
        </label>
      </section>

      <section className="grid gap-4">
        {filteredItems.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-brand">
            条件に一致する要素がありません。
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
                      <p className="mt-3 text-base font-medium text-slate-900">{item.text || '（テキストなし）'}</p>
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
                  フォーカス
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditorBubble(item.id);
                  }}
                >
                  バブルを開く
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteElement(item.id);
                  }}
                >
                  削除
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
      setStatus(`データを読み込めませんでした: ${error.message}`);
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
      setStatus('ページの要素をすべて削除しました');
    } catch (error) {
      setStatus(`ページの要素を削除できませんでした: ${error.message}`);
    }
  };

  const handleDeleteItem = async (pageUrl, id) => {
    if (!window.confirm('この要素を削除しますか？')) {
      return;
    }
    try {
      const list = await sendMessage(MessageType.DELETE, { pageUrl, id });
      updatePage(pageUrl, list);
      setStatus('要素を削除しました');
    } catch (error) {
      setStatus(`要素を削除できませんでした: ${error.message}`);
    }
  };

  const handleFocusItem = async (pageUrl, id) => {
    const tab = await findTabByPageUrl(pageUrl);
    if (!tab?.id) {
      const created = await chrome.tabs.create({ url: pageUrl });
      alert('新しいタブを開きました。サイドパネルを手動で開いてから再度お試しください。');
      return created;
    }
    await chrome.tabs.update(tab.id, { active: true });
    try {
      await sendMessage(MessageType.FOCUS_ELEMENT, { pageUrl, id, tabId: tab.id });
    } catch (error) {
      alert(`要素をフォーカスできませんでした: ${error.message}`);
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
      alert(`バブルエディターを開けませんでした: ${error.message}`);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
          <span className="text-sm font-medium text-slate-500">ページ数</span>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{entries.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
          <span className="text-sm font-medium text-slate-500">要素数</span>
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
          {loading ? '更新中…' : '更新'}
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
            まだ保存された要素はありません。
          </p>
        ) : (
          entries.map(([pageUrl, items]) => (
            <article key={pageUrl} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
              <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <h2 className="break-all text-base font-semibold text-slate-900">{pageUrl}</h2>
                  <p className="text-xs text-slate-500">{`${items.length} 件の要素`}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    onClick={() => handleOpenPage(pageUrl)}
                  >
                    ページを開く
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                    onClick={() => handleClearPage(pageUrl)}
                  >
                    ページをクリア
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
                          {item.type === 'link' ? 'リンク' : 'ボタン'}
                        </span>
                        <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{item.text || '（テキストなし）'}</p>
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
                          フォーカス
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                          onClick={() => handleEditItem(pageUrl, item.id)}
                        >
                          バブルを開く
                        </button>
                        <button
                          type="button"
                          className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                          onClick={() => handleDeleteItem(pageUrl, item.id)}
                        >
                          削除
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
    return '対象要素';
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


