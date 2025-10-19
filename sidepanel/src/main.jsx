import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageType, sendMessage } from '../../common/messaging.js';
import { getActiveTab } from '../../common/compat.js';

const defaultStyleState = () => ({
  position: '',
  color: '',
  backgroundColor: '',
  fontSize: '',
  padding: '',
  borderRadius: '',
  top: '',
  right: '',
  bottom: '',
  left: '',
});

const defaultCreatorState = () => ({
  type: 'button',
  text: '',
  href: '',
  selector: '',
  position: 'append',
  style: defaultStyleState(),
});

function App() {
  const [pageUrl, setPageUrl] = useState('');
  const [tabId, setTabId] = useState(undefined);
  const [contextLabel, setContextLabel] = useState('Loading active page...');
  const [items, setItems] = useState([]);
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [creator, setCreator] = useState(defaultCreatorState);
  const [creatorMessage, setCreatorMessage] = useState('');
  const [pendingPicker, setPendingPicker] = useState(null);
  const [editor, setEditor] = useState(null);
  const [editorMessage, setEditorMessage] = useState('');
  const [activeView, setActiveView] = useState('manage');

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
        setCreatorMessage(`Failed to load items: ${error.message}`);
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
            const selector = message.data.selector;
            const preview = formatPreview(message.data.preview);
            if (pendingPicker === 'creator') {
              setCreator((prev) => ({ ...prev, selector }));
              setCreatorMessage(`Selected ${preview}`);
            } else if (pendingPicker === 'editor') {
              setEditor((prev) => (prev ? { ...prev, selector } : prev));
              setEditorMessage(`Selected ${preview}`);
            }
          }
          setPendingPicker(null);
          break;
        }
        case MessageType.PICKER_CANCELLED:
          if (pendingPicker === 'creator') {
            setCreatorMessage('Picker cancelled');
          } else if (pendingPicker === 'editor') {
            setEditorMessage('Picker cancelled');
          }
          setPendingPicker(null);
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
    return () => {
      if (pendingPicker && tabId && pageUrl) {
        sendMessage(MessageType.CANCEL_PICKER, { tabId, pageUrl }).catch(() => {});
      }
    };
  }, [pageUrl, pendingPicker, tabId]);

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

  const handleCreatorFieldChange = (key, value) => {
    setCreator((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreatorStyleChange = (key, value) => {
    setCreator((prev) => ({
      ...prev,
      style: {
        ...prev.style,
        [key]: value,
      },
    }));
  };

  const handleEditorFieldChange = (key, value) => {
    setEditor((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleEditorStyleChange = (key, value) => {
    setEditor((prev) =>
      prev
        ? {
            ...prev,
            style: {
              ...prev.style,
              [key]: value,
            },
          }
        : prev,
    );
  };

  const handleCreatorSubmit = async (event) => {
    event.preventDefault();
    if (!pageUrl) {
      setCreatorMessage('Active page url not available yet');
      return;
    }
    if (!creator.selector.trim()) {
      setCreatorMessage('Pick a target element first');
      return;
    }
    const rawHref = (creator.href || '').trim();
    const sanitizedHref = rawHref ? sanitizeUrl(rawHref, pageUrl) : undefined;
    if (creator.type === 'link' && !sanitizedHref) {
      setCreatorMessage('Provide a valid URL for the link');
      return;
    }
    if (creator.type === 'button' && rawHref && !sanitizedHref) {
      setCreatorMessage('Optional URL is invalid, please check the format');
      return;
    }
    const payload = {
      id: crypto.randomUUID(),
      pageUrl,
      type: creator.type,
      text: creator.text.trim(),
      href: sanitizedHref,
      selector: creator.selector.trim(),
      position: creator.position,
      style: normalizeStyleState(creator.style),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      const list = await sendMessage(MessageType.CREATE, payload);
      setItems(Array.isArray(list) ? list : []);
      setCreator(defaultCreatorState());
      setCreatorMessage('Element saved');
    } catch (error) {
      setCreatorMessage(`Failed to save element: ${error.message}`);
    }
  };

  const handleFocus = async (id) => {
    try {
      await sendMessage(MessageType.FOCUS_ELEMENT, { id, tabId, pageUrl });
    } catch (error) {
      setEditorMessage(`Unable to focus element: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this element?')) {
      return;
    }
    try {
      const list = await sendMessage(MessageType.DELETE, { id, pageUrl });
      setItems(Array.isArray(list) ? list : []);
      if (editor?.id === id) {
        closeEditor();
      }
    } catch (error) {
      setEditorMessage(`Failed to delete: ${error.message}`);
    }
  };

  const openEditor = (id) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      setEditorMessage('Element not found, maybe it was removed');
      return;
    }
    setEditor({
      id: item.id,
      pageUrl: item.pageUrl,
      type: item.type,
      text: item.text || '',
      href: item.href || '',
      selector: item.selector,
      position: item.position,
      style: {
        ...defaultStyleState(),
        ...item.style,
      },
    });
    setEditorMessage('');
  };

  const closeEditor = () => {
    if (pendingPicker === 'editor' && tabId && pageUrl) {
      sendMessage(MessageType.CANCEL_PICKER, { tabId, pageUrl }).catch(() => {});
    }
    setPendingPicker((current) => (current === 'editor' ? null : current));
    setEditor(null);
    setEditorMessage('');
  };

  const handleEditorSubmit = async (event) => {
    event.preventDefault();
    if (!editor) {
      return;
    }
    if (!editor.selector.trim()) {
      setEditorMessage('Pick a target element first');
      return;
    }
    const rawHref = (editor.href || '').trim();
    const sanitizedHref = rawHref ? sanitizeUrl(rawHref, pageUrl) : undefined;
    if (editor.type === 'link' && !sanitizedHref) {
      setEditorMessage('Provide a valid URL for the link');
      return;
    }
    if (editor.type === 'button' && rawHref && !sanitizedHref) {
      setEditorMessage('Optional URL is invalid, please check the format');
      return;
    }
    try {
      const payload = {
        ...editor,
        href: sanitizedHref,
        style: normalizeStyleState(editor.style),
        updatedAt: Date.now(),
      };
      const list = await sendMessage(MessageType.UPDATE, payload);
      setItems(Array.isArray(list) ? list : []);
      setEditorMessage('Changes saved');
    } catch (error) {
      setEditorMessage(`Failed to save changes: ${error.message}`);
    }
  };

  const handlePickTarget = async (form) => {
    if (pendingPicker && form !== pendingPicker) {
      await cancelPicker(pendingPicker);
    }
    if (!pageUrl) {
      if (form === 'creator') {
        setCreatorMessage('Active page url not available yet');
      } else {
        setEditorMessage('Active page url not available yet');
      }
      return;
    }
    if (!tabId) {
      const message = 'Unable to find the active tab';
      if (form === 'creator') {
        setCreatorMessage(message);
      } else {
        setEditorMessage(message);
      }
      return;
    }
    setPendingPicker(form);
    if (form === 'creator') {
      setCreatorMessage('Click on the page to pick an element');
    } else {
      setEditorMessage('Click on the page to pick an element');
    }
    try {
      await sendMessage(MessageType.START_PICKER, { tabId, pageUrl });
    } catch (error) {
      setPendingPicker(null);
      if (form === 'creator') {
        setCreatorMessage(`Failed to start picker: ${error.message}`);
      } else {
        setEditorMessage(`Failed to start picker: ${error.message}`);
      }
    }
  };

  const cancelPicker = async (form) => {
    if (pendingPicker !== form || !tabId || !pageUrl) {
      return;
    }
    setPendingPicker(null);
    try {
      await sendMessage(MessageType.CANCEL_PICKER, { tabId, pageUrl });
    } catch (error) {
      console.warn('Failed to cancel picker', error);
    }
  };

  const resetCreator = () => {
    setCreator(defaultCreatorState());
    setCreatorMessage('');
  };

  const handleSwitchView = async (view) => {
    if (view === activeView) {
      return;
    }
    if (pendingPicker) {
      await cancelPicker(pendingPicker);
    }
    if (view === 'overview') {
      closeEditor();
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
            全局一览
          </button>
        </div>
      </header>
      {activeView === 'manage' ? (
        <>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Add element</h2>
        </div>
        <form className="flex flex-col gap-4" onSubmit={handleCreatorSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              Type
              <select
                className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={creator.type}
                onChange={(event) => handleCreatorFieldChange('type', event.target.value)}
              >
                <option value="button">Button</option>
                <option value="link">Link</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              Insert position
              <select
                className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={creator.position}
                onChange={(event) => handleCreatorFieldChange('position', event.target.value)}
              >
                <option value="append">Append</option>
                <option value="prepend">Prepend</option>
                <option value="before">Before</option>
                <option value="after">After</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm text-slate-700">
            Target selector
            <div className="flex gap-3">
              <input
                className="grow rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                type="text"
                placeholder="Use pick target to capture a selector"
                value={creator.selector}
                readOnly
                required
              />
              <button
                type="button"
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                onClick={() => handlePickTarget('creator')}
              >
                Pick target
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-700">
            Text content
            <input
              className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              type="text"
              value={creator.text}
              maxLength={160}
              onChange={(event) => handleCreatorFieldChange('text', event.target.value)}
              required
            />
          </label>

          {creator.type === 'link' && (
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              Destination URL
              <input
                className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                type="url"
                placeholder="https://example.com"
                value={creator.href}
                onChange={(event) => handleCreatorFieldChange('href', event.target.value)}
                required
              />
            </label>
          )}

          {creator.type === 'button' && (
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              Optional URL
              <input
                className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                type="url"
                placeholder="https://example.com"
                value={creator.href}
                onChange={(event) => handleCreatorFieldChange('href', event.target.value)}
              />
            </label>
          )}

          <fieldset className="rounded-xl border border-dashed border-slate-200 p-4">
            <legend className="px-2 text-sm font-semibold text-slate-600">Style overrides</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Text color
                <input
                  className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="text"
                  placeholder="#ffffff"
                  value={creator.style.color}
                  onChange={(event) => handleCreatorStyleChange('color', event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Background
                <input
                  className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="text"
                  placeholder="#1b84ff"
                  value={creator.style.backgroundColor}
                  onChange={(event) => handleCreatorStyleChange('backgroundColor', event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Font size
                <input
                  className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="text"
                  placeholder="16px"
                  value={creator.style.fontSize}
                  onChange={(event) => handleCreatorStyleChange('fontSize', event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Padding
                <input
                  className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="text"
                  placeholder="8px 16px"
                  value={creator.style.padding}
                  onChange={(event) => handleCreatorStyleChange('padding', event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Border radius
                <input
                  className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="text"
                  placeholder="4px"
                  value={creator.style.borderRadius}
                  onChange={(event) => handleCreatorStyleChange('borderRadius', event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Position mode
                <select
                  className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={creator.style.position}
                  onChange={(event) => handleCreatorStyleChange('position', event.target.value)}
                >
                  <option value="">Auto</option>
                  <option value="static">Static</option>
                  <option value="relative">Relative</option>
                  <option value="absolute">Absolute</option>
                  <option value="fixed">Fixed</option>
                </select>
              </label>
              {['top', 'right', 'bottom', 'left'].map((key) => (
                <label key={key} className="flex flex-col gap-2 text-sm text-slate-700">
                  {key.toUpperCase()}
                  <input
                    className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    type="text"
                    placeholder="auto"
                    value={creator.style[key]}
                    onChange={(event) => handleCreatorStyleChange(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
            >
              Save element
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              onClick={resetCreator}
            >
              Reset
            </button>
          </div>
          <p className="min-h-[20px] text-xs text-slate-500">{creatorMessage}</p>
        </form>
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
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand transition hover:border-blue-200 hover:shadow-xl"
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
                  onClick={() => handleFocus(item.id)}
                >
                  Focus
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                  onClick={() => openEditor(item.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
                  onClick={() => handleDelete(item.id)}
                >
                  Delete
                </button>
              </footer>
            </article>
          ))
        )}
      </section>

      {editor && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-brand">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Edit element</h2>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              onClick={closeEditor}
            >
              Close
            </button>
          </div>
          <form className="flex flex-col gap-4" onSubmit={handleEditorSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1 text-sm text-slate-700">
                Type
                <span className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                  {editor.type}
                </span>
              </div>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Insert position
                <select
                  className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={editor.position}
                  onChange={(event) => handleEditorFieldChange('position', event.target.value)}
                >
                  <option value="append">Append</option>
                  <option value="prepend">Prepend</option>
                  <option value="before">Before</option>
                  <option value="after">After</option>
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm text-slate-700">
              Text content
              <input
                className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                type="text"
                value={editor.text}
                onChange={(event) => handleEditorFieldChange('text', event.target.value)}
                required
              />
            </label>

            {editor.type === 'link' && (
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Destination URL
                <input
                  className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="url"
                  placeholder="https://example.com"
                  value={editor.href}
                  onChange={(event) => handleEditorFieldChange('href', event.target.value)}
                  required
                />
              </label>
            )}

            {editor.type === 'button' && (
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                Optional URL
                <input
                  className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="url"
                  placeholder="https://example.com"
                  value={editor.href}
                  onChange={(event) => handleEditorFieldChange('href', event.target.value)}
                />
              </label>
            )}

            <label className="flex flex-col gap-2 text-sm text-slate-700">
              Target selector
              <div className="flex gap-3">
                <input
                  className="grow rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  type="text"
                  value={editor.selector}
                  readOnly
                  required
                />
                <button
                  type="button"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                  onClick={() => handlePickTarget('editor')}
                >
                  Pick target
                </button>
              </div>
            </label>

            <fieldset className="rounded-xl border border-dashed border-slate-200 p-4">
              <legend className="px-2 text-sm font-semibold text-slate-600">Style overrides</legend>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  Text color
                  <input
                    className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={editor.style.color}
                    onChange={(event) => handleEditorStyleChange('color', event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  Background
                  <input
                    className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={editor.style.backgroundColor}
                    onChange={(event) => handleEditorStyleChange('backgroundColor', event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  Font size
                  <input
                    className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={editor.style.fontSize}
                    onChange={(event) => handleEditorStyleChange('fontSize', event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  Padding
                  <input
                    className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={editor.style.padding}
                    onChange={(event) => handleEditorStyleChange('padding', event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  Border radius
                  <input
                    className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    type="text"
                    value={editor.style.borderRadius}
                    onChange={(event) => handleEditorStyleChange('borderRadius', event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-slate-700">
                  Position mode
                  <select
                    className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    value={editor.style.position}
                    onChange={(event) => handleEditorStyleChange('position', event.target.value)}
                  >
                    <option value="">Auto</option>
                    <option value="static">Static</option>
                    <option value="relative">Relative</option>
                    <option value="absolute">Absolute</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>
                {['top', 'right', 'bottom', 'left'].map((key) => (
                  <label key={key} className="flex flex-col gap-2 text-sm text-slate-700">
                    {key.toUpperCase()}
                    <input
                      className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      type="text"
                      placeholder="auto"
                      value={editor.style[key]}
                      onChange={(event) => handleEditorStyleChange(key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
              >
                Save changes
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                onClick={closeEditor}
              >
                Cancel
              </button>
            </div>
            <p className="min-h-[20px] text-xs text-slate-500">{editorMessage}</p>
          </form>
        </section>
      )}
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
    await sendMessage(MessageType.REHYDRATE, { pageUrl });
    try {
      await sendMessage(MessageType.FOCUS_ELEMENT, { pageUrl, id, tabId: tab.id });
    } catch (error) {
      console.warn('Failed to focus element for editing', error);
    }
    if (typeof onOpenManage === 'function') {
      onOpenManage();
    }
    alert('Please use the side panel to edit this element.');
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
                          Edit in side panel
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

function normalizeStyleState(styleState) {
  const { position, ...rest } = styleState;
  const entries = {};
  if (position) {
    entries.position = position;
  }
  Object.entries(rest).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim() !== '') {
      entries[key] = value.trim();
    }
  });
  return Object.keys(entries).length ? entries : undefined;
}

function sanitizeUrl(href, baseUrl) {
  try {
    const url = new URL(href, baseUrl);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return url.href;
    }
  } catch (error) {
    return undefined;
  }
  return undefined;
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
