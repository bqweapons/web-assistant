import { noop } from './types.js';

export const MessageType = {
  LIST_BY_URL: 'LIST_BY_URL',
  LIST_ALL: 'LIST_ALL',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  CLEAR_PAGE: 'CLEAR_PAGE',
  FOCUS_ELEMENT: 'FOCUS_ELEMENT',
  START_PICKER: 'START_PICKER',
  CANCEL_PICKER: 'CANCEL_PICKER',
  PICKER_RESULT: 'PICKER_RESULT',
  PICKER_CANCELLED: 'PICKER_CANCELLED',
  REHYDRATE: 'REHYDRATE',
};

/**
 * Sends a message to the background context and resolves with the response payload.
 * @template T
 * @param {string} type
 * @param {unknown} [data]
 * @returns {Promise<T>}
 */
export async function sendMessage(type, data) {
  const response = await chrome.runtime.sendMessage({ type, data });
  if (response?.ok) {
    return response.data;
  }
  throw new Error(response?.error || 'Unknown messaging error');
}

/**
 * Registers an async message handler that can return values or promises.
 * @param {(message: { type: string; data: unknown }, sender: chrome.runtime.MessageSender) => (Promise<unknown> | unknown)} handler
 * @returns {() => void}
 */
export function addAsyncMessageListener(handler) {
  const listener = (message, sender, sendResponse) => {
    if (!message?.type) {
      return;
    }
    try {
      const result = handler(message, sender);
      if (result instanceof Promise) {
        result
          .then((data) => sendResponse({ ok: true, data }))
          .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
        return true;
      }
      sendResponse({ ok: true, data: result });
    } catch (error) {
      sendResponse({ ok: false, error: /** @type {Error} */ (error).message });
    }
    return true;
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/**
 * Opens a long-lived connection and returns helpers to post messages.
 * @param {string} name
 * @param {(port: chrome.runtime.Port) => void} onMessage
 * @returns {chrome.runtime.Port}
 */
export function connectPort(name, onMessage = noop) {
  const port = chrome.runtime.connect({ name });
  port.onMessage.addListener((msg) => onMessage(port, msg));
  return port;
}
