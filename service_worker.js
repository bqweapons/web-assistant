/**
 * サービスワーカー全体のエントリーポイント。
 * 注入要素の保存・更新・同期を担い、サイドパネルやコンテンツスクリプトへ通知する。
 */
import { getElementsByUrl, upsertElement, deleteElement, getFullStore, clearPage, replaceStore } from './common/storage.js';
import { addAsyncMessageListener, MessageType } from './common/messaging.js';
import { openSidePanelOrTab } from './common/compat.js';
import { parseActionFlowDefinition } from './common/flows.js';
import { normalizePageUrl, normalizePageLocation } from './common/url.js';

const TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);
const ELEMENT_TYPES = new Set(['button', 'link', 'tooltip', 'area']);
/** @type {Map<string, Set<number>>} */
const pageUrlTabIds = new Map();

/**
 * Tracks that a given tab is associated with a normalized page URL key.
 * @param {number | undefined} tabId
 * @param {string | undefined} pageUrl
 */
function trackTabForPageUrl(tabId, pageUrl) {
  if (typeof tabId !== 'number' || !pageUrl) {
    return;
  }
  const normalized = normalizePageUrl(pageUrl);
  if (!normalized) {
    return;
  }
  let tabSet = pageUrlTabIds.get(normalized);
  if (!tabSet) {
    tabSet = new Set();
    pageUrlTabIds.set(normalized, tabSet);
  }
  tabSet.add(tabId);
}

// Clean up tab tracking when tabs are closed.
if (chrome.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    for (const [pageUrl, tabSet] of pageUrlTabIds) {
      if (tabSet.delete(tabId) && tabSet.size === 0) {
        pageUrlTabIds.delete(pageUrl);
      }
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
  await rehydrateTabsFromStore();
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    rehydrateTabsFromStore().catch((error) => {
      console.error('[PageAugmentor] Startup rehydrate failed', error);
    });
  });
}

chrome.action.onClicked.addListener(async () => {
  await openSidePanelOrTab();
});

addAsyncMessageListener(async (message, sender) => {
  switch (message.type) {
    case MessageType.LIST_BY_URL: {
      const { pageUrl } = message.data || {};
      if (!pageUrl) {
        throw new Error('Missing pageUrl.');
      }
      if (sender.tab?.id && pageUrl) {
        trackTabForPageUrl(sender.tab.id, pageUrl);
      }
      return getElementsByUrl(pageUrl);
    }
    case MessageType.LIST_ALL: {
      const store = await getFullStore();
      return store;
    }
    case MessageType.IMPORT_STORE: {
      const { store } = message.data || {};
      const result = await importStorePayload(store);
      await rehydrateTabsFromStore();
      return result;
    }
    case MessageType.CREATE:
    case MessageType.UPDATE: {
      const element = validateElementPayload(message.data);
      if (message.type === MessageType.UPDATE) {
        element.updatedAt = Date.now();
      }
      const siteUrl = normalizePageUrl(message.data?.siteUrl || element.siteUrl || element.pageUrl);
      const list = await upsertElement(element, siteUrl);
      if (message.type === MessageType.CREATE) {
        await broadcastState(siteUrl, list);
      }
      return list;
    }
    case MessageType.DELETE: {
      const { id } = message.data || {};
      const siteUrl = normalizePageUrl(message.data?.siteUrl || message.data?.pageUrl);
      if (!id || !siteUrl) {
        throw new Error('Missing element id or pageUrl.');
      }
      const list = await deleteElement(siteUrl, id);
      await broadcastDelete(siteUrl, id);
      return list;
    }
    case MessageType.CLEAR_PAGE: {
      const siteUrl = normalizePageUrl(message.data?.siteUrl || message.data?.pageUrl);
      if (!siteUrl) {
        throw new Error('Missing pageUrl.');
      }
      await clearPage(siteUrl);
      await broadcastState(siteUrl, []);
      return [];
    }
    case MessageType.START_PICKER: {
      const { tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId) {
        throw new Error('Missing tabId for picker.');
      }
      const forwarded = { ...(message.data || {}) };
      delete forwarded.tabId;
      delete forwarded.pageUrl;
      await sendMessageToFrames(targetTabId, { type: MessageType.START_PICKER, pageUrl, data: forwarded });
      return true;
    }
    case MessageType.INIT_CREATE: {
      const { tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId) {
        throw new Error('Missing tabId for element creation.');
      }
      const forwarded = { ...(message.data || {}) };
      delete forwarded.tabId;
      delete forwarded.pageUrl;
      await sendMessageToFrames(targetTabId, { type: MessageType.INIT_CREATE, pageUrl, data: forwarded });
      return true;
    }
    case MessageType.CANCEL_PICKER: {
      const { tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId) {
        throw new Error('Missing tabId for picker cancellation.');
      }
      await sendMessageToFrames(targetTabId, { type: MessageType.CANCEL_PICKER, pageUrl });
      return true;
    }
    case MessageType.PICKER_RESULT: {
      const payload = message.data || {};
      await notifyPickerResult(MessageType.PICKER_RESULT, payload);
      return payload;
    }
    case MessageType.PICKER_CANCELLED: {
      const payload = message.data || {};
      await notifyPickerResult(MessageType.PICKER_CANCELLED, payload);
      return payload;
    }
    case MessageType.REHYDRATE: {
      const { pageUrl } = message.data || {};
      const siteUrl = normalizePageUrl(pageUrl);
      if (!siteUrl) {
        throw new Error('Missing pageUrl.');
      }
      const list = await getElementsByUrl(siteUrl);
      await broadcastState(siteUrl, list);
      return list;
    }
    case MessageType.FOCUS_ELEMENT: {
      const { id, tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId || !id) {
        throw new Error('Missing tabId or element id.');
      }
      const siteUrl = normalizePageUrl(pageUrl);
      const element = siteUrl && id ? await findElement(siteUrl, id) : null;
      await sendMessageToFrames(targetTabId, {
        type: MessageType.FOCUS_ELEMENT,
        pageUrl: siteUrl,
        data: {
          id,
          frameSelectors: element?.frameSelectors || [],
          frameUrl: element?.frameUrl,
        },
      });
      return true;
    }
    case MessageType.OPEN_EDITOR: {
      const { id, tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId || !id) {
        throw new Error('Missing tabId or element id.');
      }
      const siteUrl = normalizePageUrl(pageUrl);
      const element = siteUrl && id ? await findElement(siteUrl, id) : null;
      await sendMessageToFrames(targetTabId, {
        type: MessageType.OPEN_EDITOR,
        pageUrl: siteUrl,
        data: {
          id,
          frameSelectors: element?.frameSelectors || [],
          frameUrl: element?.frameUrl,
        },
      });
      return true;
    }
    case MessageType.SET_EDIT_MODE: {
      const { enabled, tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId) {
        throw new Error('Missing tabId for edit mode toggle.');
      }
      await sendMessageToFrames(targetTabId, {
        type: MessageType.SET_EDIT_MODE,
        pageUrl: normalizePageUrl(pageUrl),
        data: { enabled: Boolean(enabled) },
      });
      return true;
    }
    default:
      return null;
  }
});

/**
 * 要素ペイロードの必須項目を検証し、不足していれば補完する。
 * Ensures the element payload contains the required fields.
 * @param {Partial<import('./common/types.js').InjectedElement>} payload
 * @returns {import('./common/types.js').InjectedElement}
 */
function validateElementPayload(payload) {
  if (!payload) {
    throw new Error('Element payload missing.');
  }
  const siteKey = normalizePageUrl(payload.siteUrl || payload.pageUrl);
  if (!siteKey) {
    throw new Error('pageUrl is required.');
  }
  const providedPage = typeof payload.pageUrl === 'string' ? payload.pageUrl : '';
  const normalizedPage = providedPage ? normalizePageLocation(providedPage, siteKey) : '';
  const pageKey =
    providedPage && normalizePageUrl(providedPage) === siteKey && providedPage === siteKey
      ? siteKey
      : normalizedPage || siteKey;
  if (!payload.id) {
    payload.id = crypto.randomUUID();
  }
  if (!payload.selector) {
    throw new Error('selector is required.');
  }
  const now = Date.now();
  const element = {
    createdAt: payload.createdAt || now,
    ...payload,
    text: payload.text || '',
  };
  element.siteUrl = siteKey;
  element.pageUrl = pageKey;
  if (!ELEMENT_TYPES.has(element.type)) {
    element.type = 'button';
  }
  if (typeof element.containerId === 'string') {
    const trimmed = element.containerId.trim();
    if (trimmed && trimmed !== element.id) {
      element.containerId = trimmed;
    } else {
      delete element.containerId;
    }
  } else {
    delete element.containerId;
  }
  if (typeof element.floating === 'boolean') {
    element.floating = element.floating;
  } else {
    delete element.floating;
  }
  if (element.type === 'tooltip') {
    element.tooltipPosition = TOOLTIP_POSITIONS.has(element.tooltipPosition)
      ? element.tooltipPosition
      : 'top';
    element.tooltipPersistent = Boolean(element.tooltipPersistent);
  } else {
    delete element.tooltipPosition;
    delete element.tooltipPersistent;
  }
  if (element.type === 'button') {
    if (typeof element.actionFlowLocked === 'boolean') {
      element.actionFlowLocked = element.actionFlowLocked;
    } else if (typeof payload.actionFlowLocked === 'boolean') {
      element.actionFlowLocked = payload.actionFlowLocked;
    } else {
      delete element.actionFlowLocked;
    }
    if (typeof element.actionSelector === 'string') {
      const trimmedSelector = element.actionSelector.trim();
      if (trimmedSelector) {
        element.actionSelector = trimmedSelector;
      } else {
        delete element.actionSelector;
      }
    } else {
      delete element.actionSelector;
    }
    if (typeof element.actionFlow === 'string') {
      const trimmedFlow = element.actionFlow.trim();
      if (trimmedFlow) {
        const { definition, error } = parseActionFlowDefinition(trimmedFlow);
        if (error) {
          throw new Error(`Invalid action flow: ${error}`);
        }
        if (definition) {
          element.actionFlow = trimmedFlow;
        } else {
          delete element.actionFlow;
        }
      } else {
        delete element.actionFlow;
      }
    } else {
      delete element.actionFlow;
    }
    if (typeof element.href === 'string') {
      const trimmedHref = element.href.trim();
      if (trimmedHref) {
        element.href = trimmedHref;
      } else {
        delete element.href;
      }
    }
    if (element.href && !element.actionFlow && !element.actionSelector) {
      throw new Error('Buttons with a URL need an action flow.');
    }
  } else if (element.type === 'area') {
    delete element.actionFlowLocked;
    delete element.actionSelector;
    delete element.actionFlow;
    delete element.href;
    element.floating = true;
    delete element.containerId;
  } else {
    delete element.actionFlowLocked;
    delete element.actionSelector;
    delete element.actionFlow;
  }
  if (element.type === 'area') {
    element.layout = element.layout === 'column' ? 'column' : 'row';
  } else {
    delete element.layout;
  }
  if (element.type === 'link' && element.href) {
    element.linkTarget = element.linkTarget === 'same-tab' ? 'same-tab' : 'new-tab';
  } else {
    delete element.linkTarget;
  }
  if (element.containerId) {
    element.floating = false;
  }
  if (Array.isArray(element.frameSelectors)) {
    element.frameSelectors = element.frameSelectors.map((value) => String(value));
  } else {
    delete element.frameSelectors;
  }
  if (typeof element.frameLabel === 'string' && element.frameLabel.trim()) {
    element.frameLabel = element.frameLabel.trim().slice(0, 200);
  } else {
    delete element.frameLabel;
  }
  if (typeof element.frameUrl === 'string' && element.frameUrl.trim()) {
    element.frameUrl = element.frameUrl.trim();
  } else {
    delete element.frameUrl;
  }
  return element;
}

/**
 * 状態更新をサイドパネルおよび同一ページのタブへ配信する。
 * Broadcasts state updates to side panels and matching tabs.
 * @param {string} pageUrl
 * @param {import('./common/types.js').InjectedElement[]} elements
 * @returns {Promise<void>}
 */
async function broadcastState(pageUrl, elements) {
  const normalized = normalizePageUrl(pageUrl);
  if (!normalized) {
    return;
  }

  /** @type {number[]} */
  let targetTabIds = [];
  const cached = pageUrlTabIds.get(normalized);
  if (cached && cached.size > 0) {
    targetTabIds = Array.from(cached);
  } else {
    const tabs = await chrome.tabs.query({});
    const collected = [];
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || !tab.url) {
        continue;
      }
      if (normalizePageUrl(tab.url) === normalized) {
        collected.push(tab.id);
      }
    }
    if (collected.length > 0) {
      pageUrlTabIds.set(normalized, new Set(collected));
      targetTabIds = collected;
    }
  }

  if (targetTabIds.length > 0) {
    await Promise.allSettled(
      targetTabIds.map((tabId) =>
        sendMessageToFrames(tabId, { type: MessageType.REHYDRATE, pageUrl: normalized, data: elements }),
      ),
    );
  }
  try {
    await chrome.runtime.sendMessage({ type: MessageType.REHYDRATE, pageUrl: normalized, data: elements });
  } catch (error) {
    // ignore when no listeners are ready
  }
}

/**
 * Broadcasts a delete event to side panels and matching tabs.
 * @param {string} pageUrl
 * @param {string} elementId
 * @returns {Promise<void>}
 */
async function broadcastDelete(pageUrl, elementId) {
  const normalized = normalizePageUrl(pageUrl);
  if (!normalized || !elementId) {
    return;
  }

  const payload = { id: elementId, pageUrl: normalized };

  /** @type {number[]} */
  let targetTabIds = [];
  const cached = pageUrlTabIds.get(normalized);
  if (cached && cached.size > 0) {
    targetTabIds = Array.from(cached);
  } else {
    const tabs = await chrome.tabs.query({});
    const collected = [];
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || !tab.url) {
        continue;
      }
      if (normalizePageUrl(tab.url) === normalized) {
        collected.push(tab.id);
      }
    }
    if (collected.length > 0) {
      pageUrlTabIds.set(normalized, new Set(collected));
      targetTabIds = collected;
    }
  }

  if (targetTabIds.length > 0) {
    await Promise.allSettled(
      targetTabIds.map((tabId) =>
        sendMessageToFrames(tabId, { type: MessageType.DELETE, pageUrl: normalized, data: payload }),
      ),
    );
  }

  try {
    await chrome.runtime.sendMessage({ type: MessageType.DELETE, pageUrl: normalized, data: payload });
  } catch (error) {
    // ignore when no listeners are ready
  }
}

/**
 * タブへメッセージを送信し、失敗時は静かに握りつぶす。
 * Dispatches a message to a tab, ignoring failures quietly.
 * @param {number} tabId
 * @param {unknown} message
 * @returns {Promise<void>}
 */
async function safeSendMessage(tabId, message, frameId) {
  try {
    if (typeof frameId === 'number') {
      await chrome.tabs.sendMessage(tabId, message, { frameId });
    } else {
      await chrome.tabs.sendMessage(tabId, message);
    }
  } catch (error) {
    // Content script might not be injected yet; ignore silently.
  }
}

/**
 * タブ内の全フレームへメッセージを送信し、失敗時はフォールバックする。
 * Sends a message to every frame in the tab, falling back to the top frame on failure.
 * @param {number} tabId
 * @param {unknown} message
 * @returns {Promise<void>}
 */
async function sendMessageToFrames(tabId, message) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (!frames || frames.length === 0) {
      await safeSendMessage(tabId, message);
      return;
    }
    await Promise.allSettled(frames.map((frame) => safeSendMessage(tabId, message, frame.frameId)));
  } catch (error) {
    await safeSendMessage(tabId, message);
  }
}

/**
 * ストア内から指定 ID の要素を検索する。
 * Finds an element in storage by page URL and identifier.
 * @param {string} pageUrl
 * @param {string} id
 * @returns {Promise<import('./common/types.js').InjectedElement | null>}
 */
async function findElement(pageUrl, id) {
  if (!pageUrl || !id) {
    return null;
  }
  const list = await getElementsByUrl(pageUrl);
  return list.find((item) => item.id === id) || null;
}

/**
 * ピッカーイベントをリスナーへ転送し、存在しない場合は無視する。
 * Forwards picker events to any listening extension pages.
 * @param {string} type
 * @param {any} payload
 * @returns {Promise<void>}
 */
async function notifyPickerResult(type, payload) {
  try {
    const siteUrl = normalizePageUrl(payload?.siteUrl || payload?.pageUrl);
    await chrome.runtime.sendMessage({ type, pageUrl: siteUrl, data: payload });
  } catch (error) {
    // No side panel listening; ignore silently.
  }
}

/**
 * JSON インポートされたストアデータを検証し、永続化する。
 * Validates and persists an imported store payload.
 * @param {Record<string, unknown>} rawStore
 * @returns {Promise<{ pageCount: number; elementCount: number }>}
 */
async function importStorePayload(rawStore) {
  if (!rawStore || typeof rawStore !== 'object' || Array.isArray(rawStore)) {
    throw new Error('Import payload must be an object.');
  }
  const normalizedStore = {};
  let elementCount = 0;
  for (const [key, list] of Object.entries(rawStore)) {
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error('Import payload contains an invalid pageUrl.');
    }
    if (!Array.isArray(list)) {
      throw new Error(`Invalid element list for ${key}.`);
    }
    const siteUrl = normalizePageUrl(key).trim();
    if (!siteUrl) {
      throw new Error(`Import payload contains an invalid pageUrl: ${key}`);
    }
    const sanitized = [];
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`Invalid element entry for ${key}.`);
      }
      const providedPage = typeof entry.pageUrl === 'string' ? entry.pageUrl : '';
      const normalizedEntryUrl = providedPage ? normalizePageLocation(providedPage, key).trim() : '';
      const payload = {
        ...entry,
        siteUrl,
        pageUrl:
          providedPage && normalizePageUrl(providedPage) === siteUrl && providedPage === siteUrl
            ? siteUrl
            : normalizedEntryUrl || siteUrl,
      };
      try {
        const validated = validateElementPayload(payload);
        validated.siteUrl = siteUrl;
        sanitized.push(validated);
      } catch (error) {
        throw new Error(`Invalid element for ${key}: ${error.message}`);
      }
    }
    if (sanitized.length > 0) {
      normalizedStore[siteUrl] = sanitized;
      elementCount += sanitized.length;
    }
  }
  await replaceStore(normalizedStore);
  return {
    pageCount: Object.keys(normalizedStore).length,
    elementCount,
  };
}

/**
 * ストレージに保存された要素を全タブへ再配信する。
 * Rehydrates open tabs with the persisted store state.
 * @returns {Promise<void>}
 */
async function rehydrateTabsFromStore() {
  try {
    const store = await getFullStore();
    if (!store || typeof store !== 'object') {
      return;
    }
    const tasks = Object.entries(store)
      .filter(([pageUrl]) => Boolean(pageUrl))
      .map(([pageUrl, elements]) => broadcastState(pageUrl, Array.isArray(elements) ? elements : []));
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  } catch (error) {
    console.error('[PageAugmentor] Failed to rehydrate tabs from storage', error);
  }
}
