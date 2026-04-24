import { MessageType, type PageContextPayload, type RuntimeMessage } from '../../shared/messages';
import { FlowRunnerManager } from './runner/stepExecution';
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
import {
  primeSiteStoragePersistence,
  setAllSitesDataInSw,
  setSiteDataInSw,
} from './siteStorage';
import {
  appendPendingFailureNotices,
  readOrphanSentinels,
  removeSentinelKeys,
  sentinelKeyForRunId,
  SW_SUSPENDED_ERROR_CODE,
  takePendingFailureNotices,
  type RunSentinel,
} from './runner/runSentinel';
import type { FlowRunStatusPayload } from '../../shared/messages';

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

  // Review fix — `chrome.windows.create({focused: true})` for the
  // vault unlock popup shifts window focus → `tabs.onActivated` fires
  // with the popup's own chrome-extension://… tab → we'd broadcast
  // that as ACTIVE_PAGE_CONTEXT and the sidepanel would switch away
  // from the user's real browsing tab (wiping the Flows list). Any
  // URL that belongs to our own extension should be treated as "not
  // the user's current page" and skipped; the existing focus context
  // stays in place until the user returns to a real tab.
  const runtimeApiForSelf = chrome?.runtime as
    | { getURL?: (path: string) => string; id?: string }
    | undefined;
  const selfOrigin = (() => {
    try {
      const url = runtimeApiForSelf?.getURL?.('') || '';
      if (!url) {
        return '';
      }
      return new URL(url).origin;
    } catch {
      return '';
    }
  })();
  const isOwnExtensionUrl = (url?: string) => {
    if (!url) {
      return false;
    }
    if (selfOrigin && url.startsWith(selfOrigin)) {
      return true;
    }
    const id = runtimeApiForSelf?.id;
    return Boolean(id && url.startsWith(`chrome-extension://${id}/`));
  };

  // 1.13 — Unique marker for this SW lifetime. Stamped onto every run
  // sentinel so the next cold-start can distinguish our own sentinels
  // from those left behind by a previous (now-suspended) SW. `await`ing
  // orphanCleanupPromise in `start()` is the primary race guard; the
  // instance id is belt-and-braces for pathological interleavings (e.g.
  // cold-start re-running in one SW lifetime due to HMR / double-import).
  const swInstanceId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `sw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // 1.13 — Orphan-cleanup pass. Reads all run sentinels left by a prior
  // SW instance (swInstanceId mismatch) and, for those whose last-
  // recorded state was queued/running, broadcasts a failed FLOW_RUN_STATUS
  // with the `sw-suspended-during-run` error code so sidepanel can show
  // the run as failed instead of leaving it stuck on "running". Terminal-
  // state sentinels (succeeded/failed/cancelled — left from a finalize
  // whose remove() was lost to an SW-suspend race) are cleaned silently
  // without a broadcast. `start()` awaits this promise before writing a
  // fresh sentinel so a new run cannot be swept by in-progress cleanup.
  const buildSuspendedStatus = (sentinel: RunSentinel): FlowRunStatusPayload => ({
    runId: sentinel.runId,
    flowId: sentinel.flowId,
    siteKey: sentinel.siteKey,
    tabId: sentinel.tabId,
    state: 'failed',
    currentStepId: sentinel.currentStepId,
    progress: {
      completedSteps: sentinel.completedSteps,
      totalSteps: sentinel.totalSteps,
    },
    error: {
      code: SW_SUSPENDED_ERROR_CODE,
      message: 'Browser suspended the background worker during this run.',
      phase: 'execute',
      recoverable: false,
    },
    startedAt: sentinel.startedAt,
    endedAt: Date.now(),
    activeUrl: sentinel.activeUrl,
    logs: [],
  });

  const orphanCleanupPromise: Promise<void> = (async () => {
    try {
      const { orphans, strayKeys } = await readOrphanSentinels(swInstanceId);
      const toRemove: string[] = [...strayKeys];
      const pendingFailurePayloads: FlowRunStatusPayload[] = [];
      for (const sentinel of orphans) {
        toRemove.push(sentinelKeyForRunId(sentinel.runId));
        if (
          sentinel.state !== 'queued' &&
          sentinel.state !== 'running' &&
          // 1.4 — `paused` is also a non-terminal, interruptible state:
          // the run was waiting on an extension-origin unlock window
          // when the prior SW died. Fail-close via the same broadcast
          // path; the user will see the run as failed and can retry.
          sentinel.state !== 'paused'
        ) {
          // Terminal sentinel left by a prior SW whose finalize remove()
          // didn't land — clean silently, don't ghost-broadcast.
          continue;
        }
        const payload = buildSuspendedStatus(sentinel);
        // Live-listener path (may be dropped if no sidepanel is open).
        safeBroadcast({
          type: MessageType.FLOW_RUN_STATUS,
          data: payload,
          forwarded: true,
        } satisfies RuntimeMessage);
        // Persistent pull path: sidepanel mounting later will drain this
        // queue via FLOW_RUN_PENDING_FAILURES_QUERY and render the same
        // failure, so the revival notice is never silently lost.
        pendingFailurePayloads.push(payload);
      }
      if (pendingFailurePayloads.length > 0) {
        await appendPendingFailureNotices(pendingFailurePayloads);
      }
      if (toRemove.length > 0) {
        await removeSentinelKeys(toRemove);
      }
    } catch (error) {
      console.warn('orphan-cleanup-failed', error);
    }
  })();

  const flowRunnerManager = new FlowRunnerManager({
    runtime,
    tabBridge,
    swInstanceId,
    orphanCleanupPromise,
  });
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
          // F1-fix — the run-level `targetFrameId` is a pre-F1 override
          // meant for "flow was triggered from inside an iframe" (e.g.
          // an injected button in an iframe): the entire run then runs
          // in that iframe without per-step probing. Two earlier bugs
          // hid inside this call:
          //   (a) sidepanel-initiated flows also carry `sender.frameId
          //       === 0` (the sidepanel's own extension-page frame),
          //       so the override was accidentally set to 0 for every
          //       sidepanel Run click. resolveStepTargetFrame's first
          //       rule returns `run.targetFrameId` as-is, so probe was
          //       skipped and every step went to the top frame — the
          //       iframe flow step feature was broken by default.
          //   (b) a top-frame button (frameId === 0) would also set
          //       the override to 0 and disable probe, which is not
          //       what "user pressed a top-frame button" implies.
          // Fix: only treat this as a real override when the message
          // came from a tab's content script (`sender.tab.id` set)
          // AND the frame is actually an iframe (`frameId > 0`). All
          // other cases go through per-step frame resolution.
          const senderFrameId = sender?.frameId;
          const senderTabId = sender?.tab?.id;
          const targetFrameId =
            typeof senderTabId === 'number' &&
            typeof senderFrameId === 'number' &&
            senderFrameId > 0
              ? senderFrameId
              : undefined;
          const result = await flowRunnerManager.start(message.data, {
            targetFrameId,
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
      // 1.14 — site data writes routed to SW. `respondPromise` surfaces
      // `StorageQuotaExceededError` and other writer errors to the
      // sidepanel client as `{ ok: false, error }` → rejected Promise.
      case MessageType.SITES_SET_SITE: {
        void respondPromise(async () => {
          await setSiteDataInSw(message.data.siteKey, message.data.data);
          return { ok: true };
        });
        return true;
      }
      case MessageType.SITES_SET_ALL: {
        void respondPromise(async () => {
          await setAllSitesDataInSw(message.data.sites);
          return { ok: true };
        });
        return true;
      }
      // 1.13 — sidepanel drains any orphan-failure notices the SW stashed
      // during cold-start. Read-and-clear: once drained, the next query
      // sees an empty list so the same notice is never replayed twice.
      case MessageType.FLOW_RUN_PENDING_FAILURES_QUERY: {
        void respondPromise(async () => {
          const notices = (await takePendingFailureNotices()) as FlowRunStatusPayload[];
          return { ok: true, data: { notifications: notices } };
        });
        return true;
      }
      // 1.4 — Vault unlock window ↔ runner coordination. The three
      // handlers below drive the extension-origin unlock window's
      // lifecycle; see 1.4-spec.md. Invariant: the master password
      // never enters page DOM. `respondPromise` wraps the handler so
      // any throw reaches the window client as `{ok: false, error}`.
      case MessageType.FLOW_RUN_UNLOCK_CONTEXT: {
        void respondPromise(async () => {
          const ctx = flowRunnerManager.getPendingUnlockContext(message.data.runId);
          return { ok: true, data: ctx };
        });
        return true;
      }
      case MessageType.FLOW_RUN_UNLOCK_SUBMIT: {
        void respondPromise(async () => {
          const runId = message.data.runId;
          if (!flowRunnerManager.hasPendingUnlock(runId)) {
            return { ok: true, data: { ok: false, code: 'run-not-pending' as const } };
          }
          // Review fix — mark the submit in-flight so the
          // chrome.windows.onRemoved watchdog does not reject the
          // pending unlock while unlockSecretsVault (PBKDF2 +
          // decrypt) is still running. Pair with markUnlockSubmitEnd
          // in finally so the flag always clears.
          flowRunnerManager.markUnlockSubmitStart(runId);
          let unlockError: unknown;
          let unlocked = false;
          try {
            // Same SW-only path sidepanel vault manager uses. SW owns
            // the AES key (1.1); vault stays unlocked afterwards until
            // SW suspends or the user Locks manually.
            await unlockSecretsVault(message.data.password);
            unlocked = true;
          } catch (error) {
            unlockError = error;
          }
          const { closedDuringSubmit } = flowRunnerManager.markUnlockSubmitEnd(runId);
          if (unlocked) {
            // Resolve even if the window closed mid-submit — the
            // vault is now unlocked so the run can simply resume.
            flowRunnerManager.resolvePendingUnlock(runId);
            return { ok: true, data: { ok: true as const } };
          }
          const errMsg = unlockError instanceof Error ? unlockError.message : String(unlockError);
          flowRunnerManager.recordUnlockAttemptFailure(runId, errMsg);
          if (closedDuringSubmit) {
            // Window is gone and the password was wrong; there is no
            // surface to retry into, so fail the run the same way an
            // explicit user close would have.
            flowRunnerManager.rejectPendingUnlock(runId, 'cancelled');
            return {
              ok: true,
              data: { ok: false, code: 'run-not-pending' as const },
            };
          }
          const attempt = flowRunnerManager.getPendingUnlockAttempt(runId);
          return {
            ok: true,
            data: { ok: false, code: 'invalid-password' as const, attempt },
          };
        });
        return true;
      }
      case MessageType.FLOW_RUN_UNLOCK_CANCEL: {
        void respondPromise(async () => {
          flowRunnerManager.rejectPendingUnlock(message.data.runId, 'cancelled');
          return { ok: true, data: { ok: true as const } };
        });
        return true;
      }
      default:
        return;
    }
  });

  // 1.4 — Watchdog for the unlock window. `onRemoved` fires whenever
  // the popup closes — user X-button, OS kill, explicit
  // chrome.windows.remove from our own resolvePendingUnlock. The
  // manager's handleUnlockWindowRemoved encapsulates the submit-in-
  // flight guard (review fix): if the user closed the window while a
  // correct-password submit is still running, we don't reject the
  // run — the SUBMIT handler resolves it on success or fails it on
  // invalid password via the closedDuringSubmit flag.
  const windowsApi = chrome?.windows;
  if (windowsApi?.onRemoved) {
    windowsApi.onRemoved.addListener((windowId) => {
      flowRunnerManager.handleUnlockWindowRemoved(windowId);
    });
  }

  // 1.14 — Trigger a single read-through-SW at cold-start so any pending
  // normalization / legacy-migration writeback persists while we're in
  // the writer realm. Deferred by one macrotask so we don't block the
  // listener-registration flow, and wrapped in try/catch inside the
  // prime function itself so bootstrap can't fail on storage I/O.
  setTimeout(() => {
    void primeSiteStoragePersistence();
  }, 0);

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
      // Review fix — skip our own extension pages (vault unlock
      // popup, options, etc.) so they don't overwrite the user's
      // real page context in the sidepanel.
      if (isOwnExtensionUrl(url)) {
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
        // Review fix — same rationale as the onUpdated guard: the
        // vault unlock popup's `tabs.onActivated` must not clobber
        // the sidepanel's active-site context.
        if (isOwnExtensionUrl(tab?.url)) {
          return;
        }
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
