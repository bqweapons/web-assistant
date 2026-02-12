import { MessageType, type RuntimeMessage } from '../shared/messages';
import { getSiteData, STORAGE_KEY } from '../shared/storage';
import {
  isStructuredElementRecord,
  type StructuredElementRecord,
} from '../shared/siteDataSchema';
import { startPicker, stopPicker } from './content/picker';
import { handleInjectionMessage, registerPageContextIfNeeded, resetInjectionRegistry } from './content/injection';

const CONTENT_RUNTIME_READY_KEY = '__ladybirdContentRuntimeReady__';
type RuntimeMessenger = { sendMessage?: (message: unknown) => void };
const normalizeSiteKey = (value: string) =>
  value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');

const resolveSiteKeyFromLocation = (href: string) => {
  if (!href) {
    return '';
  }
  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'file:') {
      return normalizeSiteKey(href);
    }
    const host = parsed.host || parsed.hostname || '';
    return normalizeSiteKey(host || href);
  } catch {
    return '';
  }
};

const resolvePageKeyFromLocation = (href: string) => {
  if (!href) {
    return '';
  }
  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'file:') {
      return normalizeSiteKey(href.split(/[?#]/)[0] || href);
    }
    const host = parsed.host || parsed.hostname || '';
    const siteKey = normalizeSiteKey(host || href);
    const path = parsed.pathname || '/';
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${siteKey}${cleanPath}`;
  } catch {
    return '';
  }
};

const normalizeStoredPageKey = (value?: string | null) => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('/')) {
    const site = resolveSiteKeyFromLocation(window.location.href);
    return `${site}${trimmed}`;
  }
  if (!/^https?:\/\//.test(trimmed) && !trimmed.startsWith('file://')) {
    return trimmed.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');
  }
  try {
    return resolvePageKeyFromLocation(new URL(trimmed, window.location.href).toString());
  } catch {
    return '';
  }
};

const toStructuredElementPayload = (value: unknown): StructuredElementRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return isStructuredElementRecord(value) ? value : null;
};

const rehydratePersistedElements = async () => {
  if (window.top !== window) {
    return;
  }
  const siteKey = resolveSiteKeyFromLocation(window.location.href);
  const pageKey = resolvePageKeyFromLocation(window.location.href);
  if (!siteKey) {
    return;
  }
  try {
    const data = await getSiteData(siteKey);
    const elements: StructuredElementRecord[] = Array.isArray(data.elements)
      ? data.elements
          .map(toStructuredElementPayload)
          .filter((item): item is StructuredElementRecord => Boolean(item))
          .filter((item) => {
            if (item.scope !== 'page') {
              return true;
            }
            if (!item.context.pageKey) {
              return true;
            }
            return normalizeStoredPageKey(item.context.pageKey) === pageKey;
          })
      : [];
    handleInjectionMessage({
      type: MessageType.REHYDRATE_ELEMENTS,
      data: { elements },
    });
  } catch (error) {
    console.warn('Failed to rehydrate persisted elements', error);
  }
};

const startPageContextWatcher = (runtime?: RuntimeMessenger) => {
  if (!runtime?.sendMessage) {
    return () => undefined;
  }
  let lastUrl = '';
  const notify = () => {
    const href = window.location.href;
    if (!href || href === lastUrl) {
      return;
    }
    lastUrl = href;
    runtime.sendMessage?.({
      type: MessageType.PAGE_CONTEXT_PING,
      data: { url: href, title: document.title || undefined },
    });
  };

  const wrapHistory = (method: 'pushState' | 'replaceState') => {
    const original = history[method];
    if (typeof original !== 'function') {
      return () => undefined;
    }
    history[method] = function patched(this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      notify();
      return result;
    } as typeof original;
    return () => {
      history[method] = original;
    };
  };

  const stopPush = wrapHistory('pushState');
  const stopReplace = wrapHistory('replaceState');

  const handlePop = () => notify();
  const handleVisibility = () => notify();
  window.addEventListener('popstate', handlePop, true);
  window.addEventListener('hashchange', handlePop, true);
  window.addEventListener('visibilitychange', handleVisibility, true);
  notify();

  return () => {
    stopPush();
    stopReplace();
    window.removeEventListener('popstate', handlePop, true);
    window.removeEventListener('hashchange', handlePop, true);
    window.removeEventListener('visibilitychange', handleVisibility, true);
  };
};

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  allFrames: true,
  main() {
    const runtime = chrome?.runtime;
    if (!runtime?.onMessage) {
      return;
    }
    const markerHost = window as unknown as Record<string, unknown>;
    if (markerHost[CONTENT_RUNTIME_READY_KEY]) {
      return;
    }
    markerHost[CONTENT_RUNTIME_READY_KEY] = true;
    const stopWatcher = startPageContextWatcher(runtime);
    registerPageContextIfNeeded(runtime);
    rehydratePersistedElements().catch(() => undefined);
    const storageApi = chrome?.storage?.onChanged;
    const handleStorageChange = (changes: Record<string, unknown>, areaName: string) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY]) {
        return;
      }
      rehydratePersistedElements().catch(() => undefined);
    };
    storageApi?.addListener(handleStorageChange);
    runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
      const message = rawMessage as RuntimeMessage | undefined;
      if (!message?.type || message.forwarded) {
        return;
      }
      switch (message.type) {
        case MessageType.START_PICKER: {
          const accept = message.data?.accept;
          const disallowInput = message.data?.disallowInput ?? false;
          startPicker({
            accept,
            disallowInput,
            onResult(payload) {
              runtime.sendMessage({
                type: MessageType.PICKER_RESULT,
                data: payload,
              });
            },
            onCancel() {
              runtime.sendMessage({
                type: MessageType.PICKER_CANCELLED,
                data: { reason: 'cancelled' },
              });
            },
            onInvalid(reason) {
              runtime.sendMessage({
                type: MessageType.PICKER_INVALID,
                data: { reason: reason || 'invalid-target' },
              });
            },
          });
          sendResponse?.({ ok: true });
          return true;
        }
        case MessageType.CANCEL_PICKER: {
          stopPicker();
          sendResponse?.({ ok: true });
          return true;
        }
        case MessageType.CREATE_ELEMENT:
        case MessageType.UPDATE_ELEMENT:
        case MessageType.DELETE_ELEMENT:
        case MessageType.PREVIEW_ELEMENT:
        case MessageType.FOCUS_ELEMENT:
        case MessageType.SET_EDITING_ELEMENT:
        case MessageType.REHYDRATE_ELEMENTS: {
          const result = handleInjectionMessage(message);
          sendResponse?.(result ?? { ok: false, error: 'unsupported-message' });
          return true;
        }
        default:
          return;
      }
    });
    return () => {
      stopWatcher();
      resetInjectionRegistry();
      storageApi?.removeListener(handleStorageChange);
      markerHost[CONTENT_RUNTIME_READY_KEY] = false;
    };
  },
});
