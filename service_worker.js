import { getElementsByUrl, upsertElement, deleteElement, getFullStore, clearPage } from './common/storage.js';
import { addAsyncMessageListener, MessageType } from './common/messaging.js';
import { openSidePanelOrTab } from './common/compat.js';

chrome.runtime.onInstalled.addListener(async () => {
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

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
      await safeSendMessage(targetTabId, { type: MessageType.START_PICKER, pageUrl });
      return true;
    }
    case MessageType.CANCEL_PICKER: {
      const { tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId) {
        throw new Error('Missing tabId for picker cancellation.');
      }
      await safeSendMessage(targetTabId, { type: MessageType.CANCEL_PICKER, pageUrl });
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
      await safeSendMessage(targetTabId, {
        type: MessageType.FOCUS_ELEMENT,
        pageUrl,
        data: { id },
      });
      return true;
    }
    default:
      return null;
  }
});

/**
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
  return {
    createdAt: payload.createdAt || now,
    ...payload,
    text: payload.text || '',
  };
}

/**
 * Broadcasts state updates to side panels and matching tabs.
 * @param {string} pageUrl
 * @param {import('./common/types.js').InjectedElement[]} elements
 * @returns {Promise<void>}
 */
async function broadcastState(pageUrl, elements) {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs
      .filter((tab) => tab.id && tab.url && normalizeUrl(tab.url) === pageUrl)
      .map((tab) => safeSendMessage(tab.id, { type: MessageType.REHYDRATE, pageUrl, data: elements })),
  );
  try {
    await chrome.runtime.sendMessage({ type: MessageType.REHYDRATE, pageUrl, data: elements });
  } catch (error) {
    // ignore when no listeners are ready
  }
}

/**
 * Dispatches a message to a tab, ignoring failures quietly.
 * @param {number} tabId
 * @param {unknown} message
 * @returns {Promise<void>}
 */
async function safeSendMessage(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    // Content script might not be injected yet; ignore silently.
  }
}

/**
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
 * Normalizes URL for consistent storage keys.
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
