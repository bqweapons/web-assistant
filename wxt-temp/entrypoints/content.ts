import { MessageType, type RuntimeMessage } from '../shared/messages';
import { getSiteData, STORAGE_KEY } from '../shared/storage';
import { derivePageKeyFromUrl, deriveSiteKeyFromUrl, normalizeStoredPageKey } from '../shared/urlKeys';
import {
  isStructuredElementRecord,
  type StructuredElementRecord,
} from '../shared/siteDataSchema';
import { startPicker, stopPicker } from './content/picker';
import { handleInjectionMessage, registerPageContextIfNeeded, resetInjectionRegistry } from './content/injection';
import { executeFlowRunStep } from './content/flowRunner';
import { clearHiddenRulesStyle, rehydratePersistedHiddenRules } from './content/hiddenRules';

const CONTENT_RUNTIME_READY_KEY = '__ladybirdContentRuntimeReady__';
type RuntimeMessenger = { sendMessage?: (message: unknown) => void };

const toStructuredElementPayload = (value: unknown): StructuredElementRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return isStructuredElementRecord(value) ? value : null;
};

const rehydratePersistedElements = async (hrefSnapshot: string) => {
  if (window.top !== window) {
    return;
  }
  const siteKey = deriveSiteKeyFromUrl(hrefSnapshot);
  const pageKey = derivePageKeyFromUrl(hrefSnapshot);
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
            return normalizeStoredPageKey(item.context.pageKey, hrefSnapshot) === pageKey;
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

const startPageContextWatcher = (
  runtime?: RuntimeMessenger,
  onUrlChanged?: (href: string) => void,
) => {
  if (!runtime?.sendMessage) {
    return () => undefined;
  }
  if (window.top !== window) {
    return () => undefined;
  }
  let lastUrl = '';
  const notify = () => {
    const href = window.location.href;
    if (!href || href === lastUrl) {
      return;
    }
    lastUrl = href;
    onUrlChanged?.(href);
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
    let rehydrateRequestedToken = 0;
    let rehydrateAppliedToken = 0;
    let rehydrateInProgress = false;

    const applyLatestRehydrate = async (reason: string) => {
      if (rehydrateInProgress) {
        return;
      }
      rehydrateInProgress = true;
      try {
        while (rehydrateAppliedToken < rehydrateRequestedToken) {
          const token = rehydrateRequestedToken;
          const hrefSnapshot = window.location.href;
          try {
            await rehydratePersistedElements(hrefSnapshot);
            await rehydratePersistedHiddenRules();
          } catch (error) {
            console.warn('Failed to rehydrate persisted state', error);
            rehydrateAppliedToken = token;
            continue;
          }
          const isLatest = token === rehydrateRequestedToken && hrefSnapshot === window.location.href;
          if (!isLatest) {
            console.info('elements-rehydrate-stale-discarded', {
              reason,
              token,
              latestToken: rehydrateRequestedToken,
              hrefSnapshot,
              currentHref: window.location.href,
            });
            continue;
          }
          rehydrateAppliedToken = token;
        }
      } finally {
        rehydrateInProgress = false;
        if (rehydrateAppliedToken < rehydrateRequestedToken) {
          void applyLatestRehydrate('post-loop');
        }
      }
    };

    const requestRehydrate = (reason: string) => {
      rehydrateRequestedToken += 1;
      void applyLatestRehydrate(reason);
    };

    const stopWatcher = startPageContextWatcher(runtime, () => {
      requestRehydrate('url-change');
    });
    registerPageContextIfNeeded(runtime);
    requestRehydrate('init');
    const storageApi = chrome?.storage?.onChanged;
    const handleStorageChange = (changes: Record<string, unknown>, areaName: string) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY]) {
        return;
      }
      requestRehydrate('storage-change');
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
          const showInsertionMarker = message.data?.showInsertionMarker ?? true;
          startPicker({
            accept,
            disallowInput,
            showInsertionMarker,
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
        case MessageType.FLOW_RUN_EXECUTE_STEP: {
          const topFrameOnly = message.data.topFrameOnly !== false;
          if (topFrameOnly && window.top !== window) {
            sendResponse?.({
              ok: true,
              data: { accepted: false, reason: 'ignored_non_top_frame' },
            });
            return true;
          }
          sendResponse?.({ ok: true, data: { accepted: true } });
          void executeFlowRunStep(message.data)
            .then((result) => {
              runtime.sendMessage({
                type: MessageType.FLOW_RUN_STEP_RESULT,
                data: result,
              });
            })
            .catch((error) => {
              runtime.sendMessage({
                type: MessageType.FLOW_RUN_STEP_RESULT,
                data: {
                  ok: false,
                  runId: message.data.runId,
                  requestId: message.data.requestId,
                  stepId: message.data.stepId,
                  stepType: message.data.stepType,
                  errorCode: 'step-execution-exception',
                  error: error instanceof Error ? error.message : String(error),
                },
              });
            });
          return true;
        }
        default:
          return;
      }
    });
    return () => {
      stopWatcher();
      clearHiddenRulesStyle();
      resetInjectionRegistry();
      storageApi?.removeListener(handleStorageChange);
      markerHost[CONTENT_RUNTIME_READY_KEY] = false;
    };
  },
});
