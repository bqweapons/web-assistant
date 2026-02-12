import { MessageType, type RuntimeMessage } from '../shared/messages';
import { startPicker, stopPicker } from './content/picker';
import { handleInjectionMessage, registerPageContextIfNeeded, resetInjectionRegistry } from './content/injection';

const CONTENT_RUNTIME_READY_KEY = '__ladybirdContentRuntimeReady__';
type RuntimeMessenger = { sendMessage?: (message: unknown) => void };

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
      markerHost[CONTENT_RUNTIME_READY_KEY] = false;
    };
  },
});
