/**
 * サービスワーカー全体のエントリーポイント。
 * 注入要素の保存・更新・同期を担い、サイドパネルやコンテンツスクリプトへ通知する。
 */
import { getElementsByUrl, upsertElement, deleteElement, getFullStore, clearPage, replaceStore } from './common/storage.js';
import { addAsyncMessageListener, MessageType } from './common/messaging.js';
import { openSidePanelOrTab } from './common/compat.js';
import { parseActionFlowDefinition } from './common/flows.js';
import { normalizePageUrl } from './common/url.js';

const TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);
const ELEMENT_TYPES = new Set(['button', 'link', 'tooltip', 'area']);

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
      const list = await upsertElement(element);
      await broadcastState(element.pageUrl, list);
      return list;
    }
    case MessageType.DELETE: {
      const { id, pageUrl } = message.data || {};
      if (!id || !pageUrl) {
        throw new Error('Missing element id or pageUrl.');
      }
      const list = await deleteElement(pageUrl, id);
      await broadcastState(pageUrl, list);
      return list;
    }
    case MessageType.CLEAR_PAGE: {
      const { pageUrl } = message.data || {};
      if (!pageUrl) {
        throw new Error('Missing pageUrl.');
      }
      await clearPage(pageUrl);
      await broadcastState(pageUrl, []);
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
      if (!pageUrl) {
        throw new Error('Missing pageUrl.');
      }
      const list = await getElementsByUrl(pageUrl);
      await broadcastState(pageUrl, list);
      return list;
    }
    case MessageType.FOCUS_ELEMENT: {
      const { id, tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId || !id) {
        throw new Error('Missing tabId or element id.');
      }
      const element = pageUrl && id ? await findElement(pageUrl, id) : null;
      await sendMessageToFrames(targetTabId, {
        type: MessageType.FOCUS_ELEMENT,
        pageUrl,
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
      const element = pageUrl && id ? await findElement(pageUrl, id) : null;
      await sendMessageToFrames(targetTabId, {
        type: MessageType.OPEN_EDITOR,
        pageUrl,
        data: {
          id,
          frameSelectors: element?.frameSelectors || [],
          frameUrl: element?.frameUrl,
        },
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
  if (!payload.pageUrl) {
    throw new Error('pageUrl is required.');
  }
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
    delete element.actionSelector;
    delete element.actionFlow;
    delete element.href;
    element.floating = true;
    delete element.containerId;
  } else {
    delete element.actionSelector;
    delete element.actionFlow;
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
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs
      .filter((tab) => tab.id && tab.url && normalizePageUrl(tab.url) === pageUrl)
      .map((tab) => sendMessageToFrames(tab.id, { type: MessageType.REHYDRATE, pageUrl, data: elements })),
  );
  try {
    await chrome.runtime.sendMessage({ type: MessageType.REHYDRATE, pageUrl, data: elements });
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
    await chrome.runtime.sendMessage({ type, pageUrl: payload?.pageUrl, data: payload });
  } catch (error) {
    // No side panel listening; ignore silently.
  }
}

/**
 * URL を正規化してストレージキーを安定させる。
 * Normalizes URL for consistent storage keys.
 * @param {string} url
 * @returns {string}
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
    const pageUrl = normalizePageUrl(key).trim();
    if (!pageUrl) {
      throw new Error(`Import payload contains an invalid pageUrl: ${key}`);
    }
    const sanitized = [];
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') {
        throw new Error(`Invalid element entry for ${key}.`);
      }
      const normalizedEntryUrl = normalizePageUrl(entry.pageUrl || pageUrl, key).trim();
      const payload = {
        ...entry,
        pageUrl: normalizedEntryUrl || pageUrl,
      };
      try {
        const validated = validateElementPayload(payload);
        validated.pageUrl = pageUrl;
        sanitized.push(validated);
      } catch (error) {
        throw new Error(`Invalid element for ${key}: ${error.message}`);
      }
    }
    if (sanitized.length > 0) {
      normalizedStore[pageUrl] = sanitized;
      elementCount += sanitized.length;
    }
  }
  await replaceStore(normalizedStore);
  return {
    pageCount: Object.keys(normalizedStore).length,
    elementCount,
  };
}

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
