import { MessageType, type PageContextPayload, type RuntimeMessage } from '../../shared/messages';
import { FlowRunnerManager } from './runner/FlowRunnerManager';
import { derivePageContext } from './runtime/pageContext';
import { TabBridge, type TabMessageResponse } from './runtime/tabBridge';

const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';

export const bootstrapBackground = () => {
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
  const isNoReceiverError = (error: unknown) =>
    /receiving end does not exist|asynchronous response|message channel(?:\s+is)?\s+closed|before a response was received/i.test(
      error instanceof Error ? error.message : String(error ?? ''),
    );
  const safeBroadcast = (message: RuntimeMessage) => {
    if (!runtime?.sendMessage) {
      return;
    }
    try {
      const result = runtime.sendMessage(message);
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        void (result as Promise<unknown>).catch((error) => {
          if (!isNoReceiverError(error)) {
            console.warn('Runtime broadcast failed', error);
          }
        });
      }
    } catch (error) {
      if (!isNoReceiverError(error)) {
        console.warn('Runtime broadcast failed', error);
      }
    }
  };

  const tabBridge = new TabBridge({
    runtime,
    tabsApi,
    scriptingApi,
    contentScriptFile: CONTENT_SCRIPT_FILE,
  });

  const broadcastPageContext = (context: PageContextPayload) => {
    safeBroadcast({
      type: MessageType.ACTIVE_PAGE_CONTEXT,
      data: context,
      forwarded: true,
    } satisfies RuntimeMessage);
  };

  const flowRunnerManager = new FlowRunnerManager({ runtime, tabBridge });

  if (!runtime?.onMessage) {
    return;
  }

  runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const message = rawMessage as RuntimeMessage | undefined;
    if (!message?.type || message.forwarded) {
      return;
    }

    const respondPromise = async (task: () => Promise<TabMessageResponse>) => {
      try {
        const result = await task();
        sendResponse?.(result);
      } catch (error) {
        sendResponse?.({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    switch (message.type) {
      case MessageType.START_PICKER:
      case MessageType.CANCEL_PICKER:
      case MessageType.CREATE_ELEMENT:
      case MessageType.UPDATE_ELEMENT:
      case MessageType.DELETE_ELEMENT:
      case MessageType.PREVIEW_ELEMENT:
      case MessageType.FOCUS_ELEMENT:
      case MessageType.SET_EDITING_ELEMENT:
      case MessageType.REHYDRATE_ELEMENTS: {
        void respondPromise(() => tabBridge.forwardToActiveTab(message));
        return true;
      }
      case MessageType.PICKER_RESULT:
      case MessageType.PICKER_CANCELLED:
      case MessageType.PICKER_INVALID:
      case MessageType.ELEMENT_DRAFT_UPDATED: {
        safeBroadcast({ ...message, forwarded: true });
        sendResponse?.({ ok: true });
        return true;
      }
      case MessageType.FLOW_RUN_STEP_RESULT: {
        flowRunnerManager.onStepResult(message.data);
        sendResponse?.({ ok: true });
        return true;
      }
      case MessageType.GET_ACTIVE_PAGE_CONTEXT: {
        void respondPromise(async () => {
          const tab = await tabBridge.queryActiveTab();
          const context = derivePageContext(tab?.url || '', tab?.id, tab?.title);
          return { ok: true, data: context };
        });
        return true;
      }
      case MessageType.PAGE_CONTEXT_PING: {
        const frameId = typeof sender?.frameId === 'number' ? sender.frameId : 0;
        if (frameId === 0 && typeof sender?.tab?.id === 'number') {
          const url = sender.tab.url || message.data?.url || '';
          flowRunnerManager.onPageContextPing(sender.tab.id, url);
        }
        if (frameId !== 0 || sender?.tab?.active === false) {
          sendResponse?.({ ok: true });
          return true;
        }
        const context = derivePageContext(
          sender?.tab?.url || message.data?.url || '',
          sender?.tab?.id,
          sender?.tab?.title,
        );
        broadcastPageContext(context);
        sendResponse?.({ ok: true });
        return true;
      }
      case MessageType.START_FLOW_RUN: {
        void respondPromise(async () => {
          const result = await flowRunnerManager.start(message.data);
          return { ok: true, data: result };
        });
        return true;
      }
      case MessageType.STOP_FLOW_RUN: {
        void respondPromise(async () => {
          const result = flowRunnerManager.stop(message.data.runId);
          return { ok: true, data: result };
        });
        return true;
      }
      default:
        return;
    }
  });

  if (tabsApi?.onUpdated) {
    tabsApi.onUpdated.addListener((tabId, changeInfo, tab) => {
      flowRunnerManager.onTabUpdated(tabId, changeInfo, tab);
      if (!tab.active) {
        return;
      }
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
      void (async () => {
        const tab = await tabBridge.queryActiveTab();
        const context = derivePageContext(tab?.url || '', tab?.id, tab?.title);
        broadcastPageContext(context);
      })();
    });
  }
};
