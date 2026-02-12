import { MessageType, type PageContextPayload, type RuntimeMessage } from '../shared/messages';

export default defineBackground(() => {
  console.log('Hello background!', { id: browser.runtime.id });

  if (typeof chrome !== 'undefined' && chrome.sidePanel?.setPanelBehavior) {
    const result = chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    if (result && typeof result.catch === 'function') {
      result.catch((error: unknown) => {
        console.warn('Failed to enable side panel action click', error);
      });
    }
  }

  const runtime = chrome?.runtime;
  const tabsApi = chrome?.tabs;
  const scriptingApi = chrome?.scripting;
  const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';

  const normalizeSiteKey = (value: string) =>
    value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');

  const derivePageContext = (url: string, tabId?: number, title?: string): PageContextPayload => {
    const timestamp = Date.now();
    const hasAccess = /^https?:\/\//.test(url) || url.startsWith('file://');
    if (!hasAccess) {
      return {
        url: url || '',
        siteKey: '',
        pageKey: '',
        tabId,
        title,
        timestamp,
        hasAccess: false,
      };
    }
    try {
      const parsed = new URL(url);
      const host = parsed.host || parsed.hostname || '';
      const siteKey = normalizeSiteKey(host || url);
      const pathname = parsed.pathname || '/';
      const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
      return {
        url,
        siteKey,
        pageKey: `${siteKey}${cleanPath}`,
        tabId,
        title,
        timestamp,
        hasAccess: true,
      };
    } catch {
      return {
        url: url || '',
        siteKey: '',
        pageKey: '',
        tabId,
        title,
        timestamp,
        hasAccess: false,
      };
    }
  };

  const broadcastPageContext = (context: PageContextPayload) => {
    runtime?.sendMessage?.({
      type: MessageType.ACTIVE_PAGE_CONTEXT,
      data: context,
      forwarded: true,
    });
  };

  const isInjectableUrl = (url?: string) => {
    if (!url) {
      return false;
    }
    return /^https?:\/\//.test(url) || url.startsWith('file://');
  };

  const isReceivingEndMissing = (value?: string) => /receiving end does not exist/i.test(value || '');

  const normalizeForwardError = (value?: string) => {
    if (isReceivingEndMissing(value)) {
      return 'content-unavailable';
    }
    return value || 'unknown-error';
  };

  const forwardToActiveTab = (message: RuntimeMessage, sendResponse?: (response: unknown) => void) => {
    if (!tabsApi?.query || !tabsApi?.sendMessage || !runtime) {
      sendResponse?.({ ok: false, error: 'Tabs API unavailable.' });
      return;
    }
    tabsApi.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const tabId = activeTab?.id;
      if (!tabId) {
        sendResponse?.({ ok: false, error: 'No active tab.' });
        return;
      }
      const sendToTab = (allowRetry = true) => {
        tabsApi.sendMessage(tabId, message, (response) => {
          const lastError = runtime.lastError?.message;
          if (lastError) {
            if (
              allowRetry &&
              isReceivingEndMissing(lastError) &&
              isInjectableUrl(activeTab?.url) &&
              scriptingApi?.executeScript
            ) {
              scriptingApi.executeScript(
                {
                  target: { tabId, allFrames: true },
                  files: [CONTENT_SCRIPT_FILE],
                },
                () => {
                  const injectionError = runtime.lastError?.message;
                  if (injectionError) {
                    sendResponse?.({ ok: false, error: normalizeForwardError(injectionError) });
                    return;
                  }
                  sendToTab(false);
                },
              );
              return;
            }
            sendResponse?.({ ok: false, error: normalizeForwardError(lastError) });
            return;
          }

          if (response && typeof response === 'object' && 'ok' in (response as Record<string, unknown>)) {
            const typed = response as { ok?: boolean; error?: string; data?: unknown };
            if (typed.ok === false) {
              sendResponse?.({ ok: false, error: typed.error || 'content-handling-failed' });
              return;
            }
            sendResponse?.({ ok: true, data: 'data' in typed ? typed.data : response });
            return;
          }
          sendResponse?.({ ok: true, data: response });
        });
      };
      sendToTab(true);
    });
  };

  if (!runtime?.onMessage) {
    return;
  }
  runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const message = rawMessage as RuntimeMessage | undefined;
    if (!message?.type || message.forwarded) {
      return;
    }
    switch (message.type) {
      case MessageType.START_PICKER:
      case MessageType.CANCEL_PICKER: {
        forwardToActiveTab(message, sendResponse);
        return true;
      }
      case MessageType.PICKER_RESULT:
      case MessageType.PICKER_CANCELLED:
      case MessageType.PICKER_INVALID: {
        runtime.sendMessage({ ...message, forwarded: true });
        sendResponse?.({ ok: true });
        return true;
      }
      case MessageType.CREATE_ELEMENT:
      case MessageType.UPDATE_ELEMENT:
      case MessageType.DELETE_ELEMENT:
      case MessageType.PREVIEW_ELEMENT:
      case MessageType.FOCUS_ELEMENT:
      case MessageType.REHYDRATE_ELEMENTS: {
        forwardToActiveTab(message, sendResponse);
        return true;
      }
      case MessageType.GET_ACTIVE_PAGE_CONTEXT: {
        if (!tabsApi?.query) {
          sendResponse?.({ ok: false, error: 'Tabs API unavailable.' });
          return true;
        }
        tabsApi.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs[0];
          const context = derivePageContext(tab?.url || '', tab?.id, tab?.title);
          sendResponse?.({ ok: true, data: context });
        });
        return true;
      }
      case MessageType.PAGE_CONTEXT_PING: {
        const context = derivePageContext(
          message.data?.url || sender?.tab?.url || '',
          sender?.tab?.id,
          sender?.tab?.title,
        );
        broadcastPageContext(context);
        sendResponse?.({ ok: true });
        return true;
      }
      default:
        return;
    }
  });

  if (tabsApi?.onUpdated) {
    tabsApi.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (!changeInfo.url && changeInfo.status !== 'complete') {
        return;
      }
      const url = changeInfo.url || tab.url;
      if (!url) {
        return;
      }
      const context = derivePageContext(url, tabId, tab.title);
      broadcastPageContext(context);
    });
  }

  if (tabsApi?.onActivated) {
    tabsApi.onActivated.addListener(() => {
      if (!tabsApi.query) {
        return;
      }
      tabsApi.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        const context = derivePageContext(tab?.url || '', tab?.id, tab?.title);
        broadcastPageContext(context);
      });
    });
  }
});
