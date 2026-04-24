import { MessageType, type PageContextPayload, type RuntimeMessage } from '../../shared/messages';
import { FlowRunnerManager } from './runner/FlowRunnerManager';
import { derivePageContext } from './runtime/pageContext';
import { TabBridge, type TabMessageResponse } from './runtime/tabBridge';
import {
  deleteSecretValue,
  exportSecretVaultTransferPayload,
  getSecretsVaultStatus,
  importSecretVaultTransferPayload,
  lockSecretsVault,
  resetSecretsVault,
  resolveSecretValue,
  unlockSecretsVault,
  upsertSecretValue,
} from './secretsVault';

const CONTENT_SCRIPT_FILE = 'content-scripts/content.js';

// 2.11 — module-level flag guards against duplicate listener registration if
// `bootstrapBackground` is called more than once in a single SW lifetime
// (HMR during `wxt dev`, accidental double-import, etc.). `hasListener`-based
// dedup wouldn't work here: each call creates new closures (safeBroadcast,
// broadcastPageContext) so listener reference equality fails. The flag is
// set AFTER the `runtime?.onMessage` null check so a call in a context where
// the runtime API isn't yet available can retry on a later invocation.
let bootstrapped = false;

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
  const isElementInjectionMessage = (type: RuntimeMessage['type']) =>
    type === MessageType.CREATE_ELEMENT ||
    type === MessageType.UPDATE_ELEMENT ||
    type === MessageType.DELETE_ELEMENT ||
    type === MessageType.PREVIEW_ELEMENT ||
    type === MessageType.FOCUS_ELEMENT ||
    type === MessageType.SET_EDITING_ELEMENT ||
    type === MessageType.REHYDRATE_ELEMENTS;

  const forwardElementMessage = async (message: RuntimeMessage) => {
    const requestedTabId = typeof message.targetTabId === 'number' ? message.targetTabId : undefined;
    if (requestedTabId) {
      const targeted = await tabBridge.forwardToTab(requestedTabId, message);
      if (targeted.ok) {
        return targeted;
      }
      console.warn('elements-forward-tab-fallback', {
        targetTabId: requestedTabId,
        error: targeted.error || 'unknown-error',
      });
    }
    return tabBridge.forwardToActiveTab(message);
  };

  const forwardToRequestedTabOrActive = async (message: RuntimeMessage) => {
    const requestedTabId = typeof message.targetTabId === 'number' ? message.targetTabId : undefined;
    if (!requestedTabId) {
      return tabBridge.forwardToActiveTab(message);
    }
    const targeted = await tabBridge.forwardToTab(requestedTabId, message);
    if (targeted.ok) {
      return targeted;
    }
    console.warn('tab-forward-fallback', {
      targetTabId: requestedTabId,
      error: targeted.error || 'unknown-error',
    });
    return tabBridge.forwardToActiveTab(message);
  };

  if (!runtime?.onMessage) {
    return;
  }

  // 2.11 — see flag comment near top of file. Past this point we are
  // committed to registering listeners; guard flips now so any subsequent
  // call short-circuits without duplicating them. Placed AFTER the null
  // check so a retry remains possible if the runtime API wasn't ready.
  if (bootstrapped) {
    return;
  }
  bootstrapped = true;

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
      case MessageType.START_FLOW_RECORDING:
      case MessageType.STOP_FLOW_RECORDING:
      case MessageType.CREATE_ELEMENT:
      case MessageType.UPDATE_ELEMENT:
      case MessageType.DELETE_ELEMENT:
      case MessageType.PREVIEW_ELEMENT:
      case MessageType.FOCUS_ELEMENT:
      case MessageType.SET_EDITING_ELEMENT:
      case MessageType.REHYDRATE_ELEMENTS: {
        if (isElementInjectionMessage(message.type)) {
          void respondPromise(() => forwardElementMessage(message));
          return true;
        }
        void respondPromise(() => forwardToRequestedTabOrActive(message));
        return true;
      }
      case MessageType.PICKER_RESULT:
      case MessageType.PICKER_CANCELLED:
      case MessageType.PICKER_INVALID:
      case MessageType.ELEMENT_DRAFT_UPDATED:
      case MessageType.FLOW_RECORDING_EVENT:
      case MessageType.FLOW_RECORDING_STATUS: {
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
          const result = await flowRunnerManager.start(message.data, {
            targetFrameId: typeof sender?.frameId === 'number' ? sender.frameId : undefined,
          });
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
      // 1.1 — vault operations routed to the SW so the AES key stays in
      // this realm only. All handlers bubble thrown errors (e.g. "Invalid
      // master password", "Secret vault is locked") through `respondPromise`
      // → `{ ok: false, error }`; the sidepanel client surfaces them as
      // rejected Promises. Response shapes are declared in
      // `SecretsMessageResponse` in shared/messages.ts.
      case MessageType.SECRETS_STATUS: {
        void respondPromise(async () => {
          const status = await getSecretsVaultStatus();
          return { ok: true, data: status };
        });
        return true;
      }
      case MessageType.SECRETS_UNLOCK: {
        void respondPromise(async () => {
          const status = await unlockSecretsVault(message.data.password);
          return { ok: true, data: status };
        });
        return true;
      }
      case MessageType.SECRETS_LOCK: {
        void respondPromise(async () => {
          await lockSecretsVault();
          return { ok: true, data: { locked: true as const } };
        });
        return true;
      }
      case MessageType.SECRETS_RESET: {
        void respondPromise(async () => {
          const status = await resetSecretsVault();
          return { ok: true, data: status };
        });
        return true;
      }
      case MessageType.SECRETS_RESOLVE: {
        void respondPromise(async () => {
          const value = await resolveSecretValue(message.data.name);
          return { ok: true, data: { value } };
        });
        return true;
      }
      case MessageType.SECRETS_UPSERT: {
        void respondPromise(async () => {
          const status = await upsertSecretValue(message.data.name, message.data.value);
          return { ok: true, data: status };
        });
        return true;
      }
      case MessageType.SECRETS_DELETE: {
        void respondPromise(async () => {
          const status = await deleteSecretValue(message.data.name);
          return { ok: true, data: status };
        });
        return true;
      }
      case MessageType.SECRETS_EXPORT_TRANSFER: {
        void respondPromise(async () => {
          const payload = await exportSecretVaultTransferPayload(message.data.password);
          return { ok: true, data: payload };
        });
        return true;
      }
      case MessageType.SECRETS_IMPORT_TRANSFER: {
        void respondPromise(async () => {
          const status = await importSecretVaultTransferPayload(
            message.data.payload,
            message.data.password,
          );
          return { ok: true, data: status };
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

  if (tabsApi?.onRemoved) {
    tabsApi.onRemoved.addListener((tabId) => {
      flowRunnerManager.onTabRemoved(tabId);
    });
  }
};
