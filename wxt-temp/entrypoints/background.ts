import { MessageType, type RuntimeMessage } from '../shared/messages';

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

  const forwardToActiveTab = (message: RuntimeMessage, sendResponse?: (response: unknown) => void) => {
    const tabsApi = chrome?.tabs;
    const runtime = chrome?.runtime;
    if (!tabsApi?.query || !tabsApi?.sendMessage || !runtime) {
      sendResponse?.({ ok: false, error: 'Tabs API unavailable.' });
      return;
    }
    tabsApi.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) {
        sendResponse?.({ ok: false, error: 'No active tab.' });
        return;
      }
      tabsApi.sendMessage(tabId, message, (response) => {
        const lastError = runtime.lastError?.message;
        if (lastError) {
          sendResponse?.({ ok: false, error: lastError });
          return;
        }
        sendResponse?.({ ok: true, data: response });
      });
    });
  };

  const runtime = chrome?.runtime;
  if (!runtime?.onMessage) {
    return;
  }
  runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
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
      default:
        return;
    }
  });
});
