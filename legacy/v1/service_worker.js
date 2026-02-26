/**
 * サービスワーカー全体のエントリーポイント。
 * 注入要素の保存・更新・同期を担い、サイドパネルやコンテンツスクリプトへ通知する。
 */
import { getElementsByUrl, upsertElement, deleteElement, getFullStore, clearPage, replaceStore } from './common/storage.js';
import { addAsyncMessageListener, MessageType } from './common/messaging.js';
import { openSidePanelOrTab } from './common/compat.js';
import { parseActionFlowDefinition } from './common/flows.js';
import { normalizePageUrl, normalizePageLocation } from './common/url.js';
import { listFlows, upsertFlow, deleteFlow, findFlowById, getFullFlowStore, replaceFlowStore } from './common/flow-store.js';
import {
  listHiddenRules,
  upsertHiddenRule,
  deleteHiddenRule,
  getEffectiveRules,
  setHiddenRuleEnabled,
  getFullHiddenStore,
  replaceHiddenStore,
} from './common/hidden-store.js';
import { parseTransferPayload } from './common/transfer/index.js';

const TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);
const ELEMENT_TYPES = new Set(['button', 'link', 'tooltip', 'area']);
/** @type {Map<string, Set<number>>} */
const pageUrlTabIds = new Map();
const FLOW_SESSION_STORAGE_KEY = 'pageAugmentor.flowSessions';
/** @type {Map<string, { flowId: string; currentStepId: string | null; currentIndex?: number; steps?: any[]; tabId: number; pageKey?: string; pageLocation?: string; status: 'idle' | 'running' | 'paused' | 'waiting' | 'error' | 'finished'; resumeToken?: unknown; updatedAt: number; result?: unknown; waitingForNavigation?: boolean; error?: { code?: string; message?: string; detail?: unknown } }>} */
const flowSessions = new Map();
/** @type {Map<number, { pageKey?: string; capabilities?: unknown; updatedAt: number }>} */
const flowExecutors = new Map();
let flowSessionsLoaded = false;
let flowSessionSavePending = null;
/** @type {Map<string, number>} */
const flowStepTimeouts = new Map();
/** @type {Map<string, number>} */
const flowNavigationTimeouts = new Map();
const NAVIGATION_WAIT_MS = 45000;
const ELEMENT_WAIT_MS = 30000;

function getStepId(step, index) {
  if (step && typeof step.id === 'string' && step.id.trim()) {
    return step.id.trim();
  }
  return `step-${index}`;
}

function getStepTimeoutValue(step) {
  const raw = step?.timeout ?? step?.timeoutMs;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function isSameTabNavigationStep(step) {
  if (!step || typeof step !== 'object') {
    return false;
  }
  const type = typeof step.type === 'string' ? step.type.toLowerCase() : '';
  if (type !== 'navigate' && type !== 'openpage') {
    return false;
  }
  const target = typeof step.target === 'string' ? step.target.trim().toLowerCase() : '';
  return target === '' || target === '_self';
}

/**
 * Tracks that a given tab is associated with a normalized page URL key.
 * @param {number | undefined} tabId
 * @param {string | undefined} pageUrl
 */
function trackTabForPageUrl(tabId, pageUrl) {
  if (typeof tabId !== 'number' || !pageUrl) {
    return;
  }
  const normalized = normalizePageUrl(pageUrl);
  if (!normalized) {
    return;
  }
  let tabSet = pageUrlTabIds.get(normalized);
  if (!tabSet) {
    tabSet = new Set();
    pageUrlTabIds.set(normalized, tabSet);
  }
  tabSet.add(tabId);
}

// Clean up tab tracking when tabs are closed.
if (chrome.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    for (const [pageUrl, tabSet] of pageUrlTabIds) {
      if (tabSet.delete(tabId) && tabSet.size === 0) {
        pageUrlTabIds.delete(pageUrl);
      }
    }
    flowExecutors.delete(tabId);
    for (const [flowId, session] of flowSessions) {
      if (session.tabId === tabId && session.status !== 'finished' && session.status !== 'idle') {
        updateFlowSession(flowId, {
          status: 'error',
          waitingForNavigation: false,
          error: { code: 'TAB_CLOSED', message: 'Tab closed during flow.' },
        });
      }
    }
  });
}

async function ensureFlowSessionsLoaded() {
  if (flowSessionsLoaded) {
    return;
  }
  if (!chrome.storage?.session) {
    flowSessionsLoaded = true;
    return;
  }
  try {
    const stored = await chrome.storage.session.get(FLOW_SESSION_STORAGE_KEY);
    const rawSessions = stored?.[FLOW_SESSION_STORAGE_KEY];
    if (rawSessions && typeof rawSessions === 'object') {
      for (const [flowId, value] of Object.entries(rawSessions)) {
        if (value && typeof value === 'object') {
          flowSessions.set(flowId, { flowId, ...value });
        }
      }
    }
  } catch (error) {
    console.warn('[Ladybrid] Failed to load flow sessions', error);
  }
  flowSessionsLoaded = true;
}

async function persistFlowSessions() {
  if (!chrome.storage?.session) {
    return;
  }
  if (flowSessionSavePending) {
    return;
  }
  flowSessionSavePending = setTimeout(async () => {
    flowSessionSavePending = null;
    try {
      const payload = {};
      for (const [flowId, session] of flowSessions) {
        payload[flowId] = session;
      }
      await chrome.storage.session.set({ [FLOW_SESSION_STORAGE_KEY]: payload });
    } catch (error) {
      console.warn('[Ladybrid] Failed to persist flow sessions', error);
    }
  }, 50);
}

function updateFlowSession(flowId, patch) {
  if (!flowId) {
    return;
  }
  const previous =
    flowSessions.get(flowId) || { flowId, status: 'idle', tabId: -1, currentStepId: null, updatedAt: 0, waitingForNavigation: false };
  const next = {
    ...previous,
    ...patch,
    flowId,
    updatedAt: Date.now(),
  };
  flowSessions.set(flowId, next);
  persistFlowSessions();
}

function clearStepTimeout(flowId) {
  const handle = flowStepTimeouts.get(flowId);
  if (handle) {
    clearTimeout(handle);
    flowStepTimeouts.delete(flowId);
  }
}

function clearNavigationTimeout(flowId) {
  const handle = flowNavigationTimeouts.get(flowId);
  if (handle) {
    clearTimeout(handle);
    flowNavigationTimeouts.delete(flowId);
  }
}

function scheduleStepTimeout(flowId, stepId, timeoutMs) {
  clearStepTimeout(flowId);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return;
  }
  const handle = setTimeout(() => {
    updateFlowSession(flowId, {
      currentStepId: stepId || null,
      status: 'error',
      error: { code: 'STEP_TIMEOUT', message: `Step timed out after ${timeoutMs}ms.` },
    });
    flowStepTimeouts.delete(flowId);
  }, timeoutMs);
  flowStepTimeouts.set(flowId, handle);
}

function scheduleNavigationTimeout(flowId, pageUrl, timeoutMs = NAVIGATION_WAIT_MS) {
  clearNavigationTimeout(flowId);
  const handle = setTimeout(() => {
    updateFlowSession(flowId, {
      status: 'error',
      currentStepId: null,
      waitingForNavigation: false,
      error: { code: 'NAVIGATION_TIMEOUT', message: 'Navigation timeout.' },
    });
    flowNavigationTimeouts.delete(flowId);
    sendMessageToFramesForFlow(flowId, {
      type: MessageType.STEP_ERROR,
      data: { flowId, code: 'NAVIGATION_TIMEOUT', message: 'Navigation timeout.' },
      pageUrl,
    }).catch(() => {});
  }, timeoutMs);
  flowNavigationTimeouts.set(flowId, handle);
}

async function sendMessageToFramesForFlow(flowId, message) {
  await ensureFlowSessionsLoaded();
  const session = flowSessions.get(flowId);
  if (!session) return;
  await sendMessageToFrames(session.tabId, { ...message, pageUrl: session.pageKey });
}

function normalizeFlowSteps(input) {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input;
  }
  if (typeof input === 'string') {
    const { definition, error } = parseActionFlowDefinition(input);
    if (error || !definition?.steps) {
      throw new Error(error || 'Invalid flow source.');
    }
    return definition.steps;
  }
  if (input && typeof input === 'object' && Array.isArray(input.steps)) {
    return input.steps;
  }
  return [];
}

async function dispatchNextStep(flowId) {
  await ensureFlowSessionsLoaded();
  const session = flowSessions.get(flowId);
  if (!session || session.status !== 'running') {
    return null;
  }
  const steps = Array.isArray(session.steps) ? session.steps : [];
  const currentIndex = Number.isFinite(session.currentIndex) ? session.currentIndex : 0;
  if (steps.length === 0 || currentIndex >= steps.length) {
    updateFlowSession(flowId, { status: 'finished', currentStepId: null, currentIndex, waitingForNavigation: false });
    return null;
  }
  const step = steps[currentIndex];
  const stepId = getStepId(step, currentIndex);
  const timeoutValue = getStepTimeoutValue(step);
  updateFlowSession(flowId, { currentStepId: stepId, currentIndex, waitingForNavigation: false });
  try {
    await sendMessageToFrames(session.tabId, {
      type: MessageType.RUN_STEP,
      pageUrl: session.pageKey,
      data: {
        flowId,
        stepId,
        currentIndex,
        total: steps.length,
        pageKey: session.pageKey,
        tabId: session.tabId,
        stepPayload: step,
        timeout: timeoutValue,
      },
    });
    scheduleStepTimeout(flowId, stepId, timeoutValue);
    const hasMoreSteps = currentIndex + 1 < steps.length;
    if (isSameTabNavigationStep(step) && hasMoreSteps) {
      advanceStep(flowId);
      updateFlowSession(flowId, {
        status: 'waiting',
        waitingForNavigation: true,
        currentStepId: null,
      });
      return step;
    }
  } catch (error) {
    updateFlowSession(flowId, {
      status: 'error',
      error: { code: 'DISPATCH_FAILED', message: error?.message || 'Failed to dispatch step.' },
    });
    throw error;
  }
  return step;
}

async function resumeWaitingFlowsForTab(tabId, pageUrl) {
  await ensureFlowSessionsLoaded();
  const candidates = Array.from(flowSessions.values()).filter(
    (session) => session.tabId === tabId && session.status === 'waiting' && session.waitingForNavigation,
  );
  if (candidates.length === 0) {
    return;
  }
  if (!flowExecutors.has(tabId)) {
    return;
  }
  const resolvedPageKey = normalizePageUrl(pageUrl) || pageUrl || undefined;
  const resolvedPageLocation = normalizePageLocation(pageUrl) || resolvedPageKey || pageUrl || undefined;
  for (const session of candidates) {
    clearStepTimeout(session.flowId);
    updateFlowSession(session.flowId, {
      status: 'running',
      waitingForNavigation: false,
      pageKey: resolvedPageKey || session.pageKey,
      pageLocation: resolvedPageLocation || session.pageLocation,
      currentStepId: null,
    });
    await dispatchNextStep(session.flowId);
  }
}

async function resumeRunningFlowsForTab(tabId, pageUrl) {
  await ensureFlowSessionsLoaded();
  const resolvedPageKey = normalizePageUrl(pageUrl) || pageUrl || undefined;
  const resolvedPageLocation = normalizePageLocation(pageUrl) || resolvedPageKey || pageUrl || undefined;
  if (!resolvedPageKey) {
    return;
  }
  const candidates = Array.from(flowSessions.values()).filter((session) => {
    if (session.tabId !== tabId || session.status !== 'running') {
      return false;
    }
    const sessionLocation = session.pageLocation || session.pageKey;
    return Boolean(sessionLocation && sessionLocation !== resolvedPageLocation);
  });
  if (candidates.length === 0) {
    return;
  }
  if (!flowExecutors.has(tabId)) {
    return;
  }
  for (const session of candidates) {
    clearStepTimeout(session.flowId);
    updateFlowSession(session.flowId, {
      status: 'running',
      waitingForNavigation: false,
      pageKey: resolvedPageKey,
      pageLocation: resolvedPageLocation,
      currentStepId: null,
    });
    await dispatchNextStep(session.flowId);
  }
}

function advanceStep(flowId) {
  const session = flowSessions.get(flowId);
  if (!session) {
    return;
  }
  const nextIndex = (Number.isFinite(session.currentIndex) ? session.currentIndex : 0) + 1;
  updateFlowSession(flowId, { currentIndex: nextIndex, currentStepId: null });
}

chrome.runtime.onInstalled.addListener(async () => {
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
  await rehydrateTabsFromStore();
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    rehydrateTabsFromStore().catch((error) => {
      console.error('[Ladybrid] Startup rehydrate failed', error);
    });
  });
}

if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      resumeWaitingFlowsForTab(tabId, tab?.url).catch(() => {});
      resumeRunningFlowsForTab(tabId, tab?.url).catch(() => {});
    }
  });
}

chrome.action.onClicked.addListener(async () => {
  await openSidePanelOrTab();
});

addAsyncMessageListener(async (message, sender) => {
  switch (message.type) {
    case MessageType.RUN_FLOW: {
      const { flowId, steps, flowSource, definition, tabId, pageKey, targetUrl, pageUrl, resumeToken } = message.data || {};
      const targetTabId = typeof tabId === 'number' ? tabId : sender.tab?.id;
      if (!flowId || typeof targetTabId !== 'number') {
        throw new Error('Missing flowId or tabId for flow run.');
      }
      if (!flowExecutors.has(targetTabId)) {
        throw new Error(`No executor registered for tab ${targetTabId}.`);
      }
      let resolvedSteps = normalizeFlowSteps(steps || definition || flowSource);
      if ((!resolvedSteps || resolvedSteps.length === 0) && flowId) {
        const { flow } = await findFlowById(flowId);
        if (flow && Array.isArray(flow.steps)) {
          resolvedSteps = normalizeFlowSteps(flow.steps);
        }
      }
      if (!resolvedSteps || resolvedSteps.length === 0) {
        throw new Error('No steps to run.');
      }
      const resolvedInput = pageKey || targetUrl || pageUrl;
      const resolvedPageKey = normalizePageUrl(resolvedInput) || pageKey || targetUrl || pageUrl || undefined;
      const resolvedPageLocation = normalizePageLocation(resolvedInput) || resolvedPageKey || resolvedInput || undefined;
      await ensureFlowSessionsLoaded();
      clearStepTimeout(flowId);
      updateFlowSession(flowId, {
        tabId: targetTabId,
        pageKey: resolvedPageKey,
        pageLocation: resolvedPageLocation,
        status: 'running',
        currentIndex: 0,
        currentStepId: null,
        resumeToken,
        steps: resolvedSteps,
        result: undefined,
        error: undefined,
        waitingForNavigation: false,
      });
      await dispatchNextStep(flowId);
      return flowSessions.get(flowId) || null;
    }
    case MessageType.PAUSE_FLOW: {
      const { flowId } = message.data || {};
      if (!flowId) {
        throw new Error('Missing flowId for pause.');
      }
      await ensureFlowSessionsLoaded();
      const session = flowSessions.get(flowId);
      if (!session) {
        return null;
      }
      clearStepTimeout(flowId);
      updateFlowSession(flowId, { status: 'paused', waitingForNavigation: false });
      try {
        await sendMessageToFrames(session.tabId, {
          type: MessageType.STEP_DONE,
          pageUrl: session.pageKey,
          data: { flowId, status: 'paused' },
        });
      } catch (_error) {
        // ignore
      }
      return flowSessions.get(flowId) || null;
    }
    case MessageType.RESUME_FLOW: {
      const { flowId } = message.data || {};
      if (!flowId) {
        throw new Error('Missing flowId for resume.');
      }
      await ensureFlowSessionsLoaded();
      const session = flowSessions.get(flowId);
      if (!session) {
        return null;
      }
      updateFlowSession(flowId, { status: 'running', waitingForNavigation: false });
      try {
        await sendMessageToFrames(session.tabId, {
          type: MessageType.STEP_DONE,
          pageUrl: session.pageKey,
          data: { flowId, status: 'running' },
        });
      } catch (_error) {
        // ignore
      }
      await dispatchNextStep(flowId);
      return flowSessions.get(flowId) || null;
    }
    case MessageType.STOP_FLOW: {
      const { flowId } = message.data || {};
      if (!flowId) {
        throw new Error('Missing flowId for stop.');
      }
      await ensureFlowSessionsLoaded();
      clearStepTimeout(flowId);
      updateFlowSession(flowId, {
        status: 'idle',
        currentStepId: null,
        currentIndex: 0,
        steps: [],
        result: undefined,
        error: undefined,
        waitingForNavigation: false,
      });
      const session = flowSessions.get(flowId);
      if (session) {
        try {
          await sendMessageToFrames(session.tabId, {
            type: MessageType.STEP_DONE,
            pageUrl: session.pageKey,
            data: { flowId, status: 'stopped' },
          });
        } catch (_error) {
          // ignore
        }
      }
      return flowSessions.get(flowId) || null;
    }
    case MessageType.LIST_FLOWS: {
      const { pageUrl } = message.data || {};
      return listFlows({ pageUrl });
    }
    case MessageType.UPSERT_FLOW: {
      const { flow, pageUrl } = message.data || {};
      const list = await upsertFlow({ flow, pageUrl });
      return list;
    }
    case MessageType.DELETE_FLOW: {
      const { id, pageUrl } = message.data || {};
      const list = await deleteFlow({ id, pageUrl });
      return list;
    }
    case MessageType.LIST_BY_URL: {
      const { pageUrl } = message.data || {};
      if (!pageUrl) {
        throw new Error('Missing pageUrl.');
      }
      if (sender.tab?.id && pageUrl) {
        trackTabForPageUrl(sender.tab.id, pageUrl);
      }
      return getElementsByUrl(pageUrl);
    }
    case MessageType.LIST_ALL: {
      const store = await getFullStore();
      return store;
    }
    case MessageType.LIST_FLOW_STORE: {
      const store = await getFullFlowStore();
      return store;
    }
    case MessageType.LIST_HIDDEN_STORE: {
      const store = await getFullHiddenStore();
      return store;
    }
    case MessageType.IMPORT_STORE: {
      const { store } = message.data || {};
      const result = await importStorePayload(store);
      await rehydrateTabsFromStore();
      return result;
    }
    case MessageType.CREATE:
    case MessageType.UPDATE: {
      const element = validateElementPayload(message.data);
      if (message.type === MessageType.UPDATE) {
        element.updatedAt = Date.now();
      }
      const siteUrl = normalizePageUrl(message.data?.siteUrl || element.siteUrl || element.pageUrl);
      const list = await upsertElement(element, siteUrl);
      if (message.type === MessageType.CREATE) {
        await broadcastState(siteUrl, list);
      } else {
        const updated = list.find((entry) => entry.id === element.id) || element;
        await broadcastUpdate(siteUrl, updated);
      }
      return list;
    }
    case MessageType.DELETE: {
      const { id } = message.data || {};
      const siteUrl = normalizePageUrl(message.data?.siteUrl || message.data?.pageUrl);
      if (!id || !siteUrl) {
        throw new Error('Missing element id or pageUrl.');
      }
      const list = await deleteElement(siteUrl, id);
      await broadcastDelete(siteUrl, id);
      return list;
    }
    case MessageType.CLEAR_PAGE: {
      const siteUrl = normalizePageUrl(message.data?.siteUrl || message.data?.pageUrl);
      if (!siteUrl) {
        throw new Error('Missing pageUrl.');
      }
      await clearPage(siteUrl);
      await broadcastState(siteUrl, []);
      return [];
    }
    case MessageType.START_PICKER: {
      const { tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId) {
        throw new Error('Missing tabId for picker.');
      }
      const forwarded = { ...(message.data || {}) };
      delete forwarded.tabId;
      delete forwarded.pageUrl;
      await sendMessageToFrames(targetTabId, { type: MessageType.START_PICKER, pageUrl, data: forwarded });
      return true;
    }
    case MessageType.BEGIN_DRAFT: {
      const { tabId, pageUrl } = message.data || {};
      if (!tabId) {
        throw new Error('Missing tabId for draft.');
      }
      const response = await sendMessageToTab(tabId, {
        type: MessageType.BEGIN_DRAFT,
        pageUrl: normalizePageUrl(pageUrl),
        data: { ...(message.data || {}), forwarded: true },
      });
      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to create draft element.');
      }
      return response.data;
    }
    case MessageType.CANCEL_DRAFT: {
      const { tabId, pageUrl, id } = message.data || {};
      if (!tabId) {
        throw new Error('Missing tabId for draft cancel.');
      }
      await sendMessageToFrames(tabId, {
        type: MessageType.CANCEL_DRAFT,
        pageUrl: normalizePageUrl(pageUrl),
        data: { id },
      });
      return true;
    }
    case MessageType.FINALIZE_DRAFT: {
      const { tabId, pageUrl, id } = message.data || {};
      if (!tabId) {
        throw new Error('Missing tabId for draft finalize.');
      }
      await sendMessageToFrames(tabId, {
        type: MessageType.FINALIZE_DRAFT,
        pageUrl: normalizePageUrl(pageUrl),
        data: { id },
      });
      return true;
    }
    case MessageType.PREVIEW_ELEMENT: {
      const { tabId, pageUrl, element, id, reset } = message.data || {};
      if (!tabId) {
        throw new Error('Missing tabId for preview.');
      }
      await sendMessageToFrames(tabId, {
        type: MessageType.PREVIEW_ELEMENT,
        pageUrl: normalizePageUrl(pageUrl || element?.pageUrl),
        data: { element, id, reset, pageUrl: normalizePageUrl(pageUrl || element?.pageUrl) },
      });
      return true;
    }
    case MessageType.SET_EDITING_ELEMENT: {
      const { tabId, pageUrl, id, enabled } = message.data || {};
      if (!tabId || !id) {
        throw new Error('Missing tabId or element id for editing state.');
      }
      const normalized = normalizePageUrl(pageUrl);
      const element = normalized ? await findElement(normalized, id) : null;
      await sendMessageToFrames(tabId, {
        type: MessageType.SET_EDITING_ELEMENT,
        pageUrl: normalized,
        data: { id, enabled: Boolean(enabled), frameSelectors: element?.frameSelectors || [] },
      });
      return true;
    }
    case MessageType.LIST_HIDDEN_RULES: {
      const { pageUrl, scope = 'page', effective = true } = message.data || {};
      if (!pageUrl && scope !== 'global') {
        throw new Error('Missing pageUrl for hidden rules.');
      }
      if (effective) {
        return getEffectiveRules(pageUrl || '');
      }
      return listHiddenRules({ scope, pageUrl });
    }
    case MessageType.UPSERT_HIDDEN_RULE: {
      const { rule, scope = 'page', pageUrl, tabId } = message.data || {};
      if (scope !== 'global' && !pageUrl) {
        throw new Error('Missing pageUrl for hidden rule.');
      }
      const list = await upsertHiddenRule({ rule, scope, pageUrl });
      const targetTabId = tabId ?? sender.tab?.id;
      if (targetTabId && (pageUrl || sender.tab?.url)) {
        const targetUrl = pageUrl || sender.tab?.url;
        await pushHiddenRulesToTab(targetTabId, targetUrl);
      }
      return list;
    }
    case MessageType.DELETE_HIDDEN_RULE: {
      const { id, scope = 'page', pageUrl, tabId } = message.data || {};
      const list = await deleteHiddenRule({ id, scope, pageUrl });
      const targetTabId = tabId ?? sender.tab?.id;
      if (targetTabId && (pageUrl || sender.tab?.url)) {
        await pushHiddenRulesToTab(targetTabId, pageUrl || sender.tab?.url);
      }
      return list;
    }
    case MessageType.SET_HIDDEN_RULE_ENABLED: {
      const { id, enabled, scope = 'page', pageUrl, tabId } = message.data || {};
      const list = await setHiddenRuleEnabled({ id, enabled, scope, pageUrl });
      const targetTabId = tabId ?? sender.tab?.id;
      if (targetTabId && (pageUrl || sender.tab?.url)) {
        await pushHiddenRulesToTab(targetTabId, pageUrl || sender.tab?.url);
      }
      return list;
    }
    case MessageType.INIT_CREATE: {
      const { tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId) {
        throw new Error('Missing tabId for element creation.');
      }
      const forwarded = { ...(message.data || {}) };
      delete forwarded.tabId;
      delete forwarded.pageUrl;
      await sendMessageToFrames(targetTabId, { type: MessageType.INIT_CREATE, pageUrl, data: forwarded });
      return true;
    }
    case MessageType.CANCEL_PICKER: {
      const { tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId) {
        throw new Error('Missing tabId for picker cancellation.');
      }
      await sendMessageToFrames(targetTabId, { type: MessageType.CANCEL_PICKER, pageUrl });
      return true;
    }
    case MessageType.REGISTER_EXECUTOR: {
      const { tabId, pageKey, capabilities } = message.data || {};
      const targetTabId = typeof tabId === 'number' ? tabId : sender.tab?.id;
      if (typeof targetTabId !== 'number') {
        throw new Error('Missing tabId for executor registration.');
      }
      flowExecutors.set(targetTabId, { pageKey, capabilities, updatedAt: Date.now() });
      await resumeWaitingFlowsForTab(targetTabId, pageKey);
      return { tabId: targetTabId, pageKey };
    }
    case MessageType.RUN_STEP: {
      const { flowId, stepId, pageKey, targetUrl, pageUrl, resumeToken, tabId, timeout, timeoutMs, stepPayload, ...rest } =
        message.data || {};
      const targetTabId = typeof tabId === 'number' ? tabId : sender.tab?.id;
      if (!flowId || typeof targetTabId !== 'number') {
        throw new Error('Missing flowId or tabId for run.');
      }
      if (!flowExecutors.has(targetTabId)) {
        throw new Error(`No executor registered for tab ${targetTabId}.`);
      }
      await ensureFlowSessionsLoaded();
      const resolvedInput = pageKey || targetUrl || pageUrl;
      const resolvedPageKey = normalizePageUrl(resolvedInput) || pageKey || targetUrl || pageUrl || undefined;
      const resolvedPageLocation = normalizePageLocation(resolvedInput) || resolvedPageKey || resolvedInput || undefined;
      updateFlowSession(flowId, {
        currentStepId: stepId || null,
        tabId: targetTabId,
        pageKey: resolvedPageKey,
        pageLocation: resolvedPageLocation,
        status: 'running',
        resumeToken,
        waitingForNavigation: false,
      });
      const payload = {
        flowId,
        stepId,
        pageKey,
        targetUrl,
        pageUrl,
        resumeToken,
        stepPayload,
        tabId: targetTabId,
        timeout: timeout ?? timeoutMs ?? stepPayload?.timeout ?? stepPayload?.timeoutMs,
        ...rest,
      };
      delete payload.tabId;
      try {
        await sendMessageToFrames(targetTabId, {
          type: MessageType.RUN_STEP,
          pageUrl: resolvedPageKey,
          data: payload,
        });
    const timeoutValue =
      Number(payload.timeout) || Number(stepPayload?.timeout) || Number(stepPayload?.timeoutMs) || 0;
    scheduleStepTimeout(flowId, stepId, timeoutValue);
    const hasMoreSteps =
      flowSessions.has(flowId) &&
      Array.isArray(flowSessions.get(flowId).steps) &&
      (Number.isFinite(flowSessions.get(flowId).currentIndex) ? flowSessions.get(flowId).currentIndex : 0) + 1 <
        flowSessions.get(flowId).steps.length;
    if (isSameTabNavigationStep(stepPayload) && hasMoreSteps) {
      advanceStep(flowId);
      updateFlowSession(flowId, {
        status: 'waiting',
        waitingForNavigation: true,
        result: undefined,
        error: undefined,
      });
      scheduleNavigationTimeout(flowId, resolvedPageKey);
      return flowSessions.get(flowId) || null;
    }
  } catch (error) {
        updateFlowSession(flowId, {
          status: 'error',
          error: { code: 'DISPATCH_FAILED', message: error?.message || 'Failed to dispatch step.' },
        });
        throw error;
      }
      return flowSessions.get(flowId) || null;
    }
    case MessageType.STEP_DONE: {
      const { flowId, stepId, result } = message.data || {};
      await ensureFlowSessionsLoaded();
      if (flowId && flowSessions.has(flowId)) {
        clearStepTimeout(flowId);
        const session = flowSessions.get(flowId);
        if (session && session.status === 'waiting' && session.waitingForNavigation) {
          updateFlowSession(flowId, {
            result,
            error: undefined,
          });
          return true;
        }
        if (session && stepId && session.currentStepId && session.currentStepId !== stepId) {
          return true;
        }
        const stepIndex = Number.isFinite(session?.currentIndex) ? session.currentIndex : 0;
        const currentStep = session && Array.isArray(session.steps) ? session.steps[stepIndex] : null;
        const navigationStep = isSameTabNavigationStep(currentStep);
        const hasMore =
          session && Array.isArray(session.steps)
            ? (Number.isFinite(stepIndex) ? stepIndex : 0) + 1 < session.steps.length
            : false;
        if (session && session.status === 'paused') {
          updateFlowSession(flowId, {
            currentStepId: null,
            result,
            error: undefined,
            waitingForNavigation: false,
          });
          try {
            await sendMessageToFrames(session.tabId, {
              type: MessageType.STEP_DONE,
              pageUrl: session.pageKey,
              data: { flowId, stepId, status: 'paused', result },
            });
          } catch (_error) {
            // ignore
          }
          return true;
        }
    if (session && session.status === 'running' && hasMore && navigationStep) {
      advanceStep(flowId);
      updateFlowSession(flowId, {
        status: 'waiting',
        waitingForNavigation: true,
        result,
        error: undefined,
      });
      try {
        await sendMessageToFrames(session.tabId, {
          type: MessageType.STEP_DONE,
          pageUrl: session.pageKey,
          data: { flowId, stepId, status: 'waiting', result },
        });
      } catch (_error) {
        // ignore
      }
      return true;
    }
        if (session && session.status === 'running' && hasMore) {
          advanceStep(flowId);
          await dispatchNextStep(flowId);
        } else {
          updateFlowSession(flowId, {
            currentStepId: stepId || null,
            status: 'finished',
            result,
            error: undefined,
            waitingForNavigation: false,
          });
          try {
            await sendMessageToFrames(session.tabId, {
              type: MessageType.STEP_DONE,
              pageUrl: session.pageKey,
              data: { flowId, stepId, status: 'finished', result },
            });
          } catch (_error) {
            // ignore
          }
        }
      }
      return true;
    }
    case MessageType.STEP_ERROR: {
      const { flowId, stepId, code, message: errorMessage, detail } = message.data || {};
      await ensureFlowSessionsLoaded();
      if (flowId && flowSessions.has(flowId)) {
        clearStepTimeout(flowId);
        const session = flowSessions.get(flowId);
        if (session && String(code || '').toUpperCase() === 'ELEMENT_NOT_FOUND' && session.status === 'running') {
          const stepIndex = Number.isFinite(session.currentIndex) ? session.currentIndex : 0;
          const currentStep = Array.isArray(session.steps) ? session.steps[stepIndex] : null;
          const waitMs = getStepTimeoutValue(currentStep) ?? ELEMENT_WAIT_MS;
          updateFlowSession(flowId, {
            currentStepId: null,
            status: 'waiting',
            waitingForNavigation: true,
            error: undefined,
          });
          scheduleNavigationTimeout(flowId, session.pageKey, waitMs);
          try {
            await sendMessageToFrames(session.tabId, {
              type: MessageType.STEP_DONE,
              pageUrl: session.pageKey,
              data: { flowId, stepId, status: 'waiting' },
            });
          } catch (_error) {
            // ignore
          }
          return true;
        }
        if (session && stepId && session.currentStepId && session.currentStepId !== stepId) {
          return true;
        }
        updateFlowSession(flowId, {
          currentStepId: stepId || null,
          status: 'error',
          waitingForNavigation: false,
          error: { code, message: errorMessage, detail },
        });
      }
      try {
        await chrome.runtime.sendMessage({
          type: MessageType.STEP_ERROR,
          data: { flowId, stepId, code, message: errorMessage, detail },
        });
      } catch (_error) {
        // ignore
      }
      try {
        if (flowId && flowSessions.has(flowId)) {
          const session = flowSessions.get(flowId);
          await sendMessageToFrames(session?.tabId, {
            type: MessageType.STEP_ERROR,
            pageUrl: session?.pageKey,
            data: { flowId, stepId, code, message: errorMessage, detail },
          });
        }
      } catch (_error) {
        // ignore
      }
      return true;
    }
    case MessageType.REJOIN_FLOW: {
      const { flowId } = message.data || {};
      if (!flowId) {
        throw new Error('Missing flowId for rejoin.');
      }
      await ensureFlowSessionsLoaded();
      const session = flowSessions.get(flowId) || null;
      if (!session) {
        return null;
      }
      const targetTabId = session.tabId;
      if (typeof targetTabId === 'number' && !flowExecutors.has(targetTabId)) {
        try {
          const tab = await chrome.tabs.get(targetTabId);
          if (!tab) {
            return null;
          }
        } catch (_error) {
          return null;
        }
      }
      try {
        await sendMessageToFrames(session.tabId, {
          type: MessageType.REJOIN_FLOW,
          pageUrl: session.pageKey,
          data: { flowId: session.flowId, pageKey: session.pageKey, status: session.status },
        });
      } catch (_error) {
        // ignore
      }
      return session;
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
      const siteUrl = normalizePageUrl(pageUrl);
      if (!siteUrl) {
        throw new Error('Missing pageUrl.');
      }
      const list = await getElementsByUrl(siteUrl);
      await broadcastState(siteUrl, list);
      return list;
    }
    case MessageType.FOCUS_ELEMENT: {
      const { id, tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId || !id) {
        throw new Error('Missing tabId or element id.');
      }
      const siteUrl = normalizePageUrl(pageUrl);
      const element = siteUrl && id ? await findElement(siteUrl, id) : null;
      await sendMessageToFrames(targetTabId, {
        type: MessageType.FOCUS_ELEMENT,
        pageUrl: siteUrl,
        data: {
          id,
          frameSelectors: element?.frameSelectors || [],
          frameUrl: element?.frameUrl,
        },
      });
      return true;
    }
    case MessageType.SET_EDIT_MODE: {
      const { enabled, tabId, pageUrl } = message.data || {};
      const targetTabId = tabId ?? sender.tab?.id;
      if (!targetTabId) {
        throw new Error('Missing tabId for edit mode toggle.');
      }
      await sendMessageToFrames(targetTabId, {
        type: MessageType.SET_EDIT_MODE,
        pageUrl: normalizePageUrl(pageUrl),
        data: { enabled: Boolean(enabled) },
      });
      return true;
    }
    default:
      return null;
  }
});

/**
 * 要素ペイロードの必須項目を検証し、不足していれば補完する。
 * Ensures the element payload contains the required fields.
 * @param {Partial<import('./common/types.js').InjectedElement>} payload
 * @returns {import('./common/types.js').InjectedElement}
 */
function validateElementPayload(payload) {
  if (!payload) {
    throw new Error('Element payload missing.');
  }
  const siteKey = normalizePageUrl(payload.siteUrl || payload.pageUrl);
  if (!siteKey) {
    throw new Error('pageUrl is required.');
  }
  const providedPage = typeof payload.pageUrl === 'string' ? payload.pageUrl : '';
  const normalizedPage = providedPage ? normalizePageLocation(providedPage, siteKey) : '';
  const pageKey =
    providedPage && normalizePageUrl(providedPage) === siteKey && providedPage === siteKey
      ? siteKey
      : normalizedPage || siteKey;
  if (!payload.id) {
    payload.id = crypto.randomUUID();
  }
  if (!payload.selector) {
    throw new Error('selector is required.');
  }
  const now = Date.now();
  const element = {
    createdAt: payload.createdAt || now,
    ...payload,
    text: payload.text || '',
  };
  element.siteUrl = siteKey;
  element.pageUrl = pageKey;
  if (!ELEMENT_TYPES.has(element.type)) {
    element.type = 'button';
  }
  if (typeof element.containerId === 'string') {
    const trimmed = element.containerId.trim();
    if (trimmed && trimmed !== element.id) {
      element.containerId = trimmed;
    } else {
      delete element.containerId;
    }
  } else {
    delete element.containerId;
  }
  if (typeof element.floating === 'boolean') {
    element.floating = element.floating;
  } else {
    delete element.floating;
  }
  if (element.type === 'tooltip') {
    element.tooltipPosition = TOOLTIP_POSITIONS.has(element.tooltipPosition)
      ? element.tooltipPosition
      : 'top';
    element.tooltipPersistent = Boolean(element.tooltipPersistent);
  } else {
    delete element.tooltipPosition;
    delete element.tooltipPersistent;
  }
  if (element.type === 'button') {
    if (typeof element.actionFlowLocked === 'boolean') {
      element.actionFlowLocked = element.actionFlowLocked;
    } else if (typeof payload.actionFlowLocked === 'boolean') {
      element.actionFlowLocked = payload.actionFlowLocked;
    } else {
      delete element.actionFlowLocked;
    }
    if (typeof element.actionFlowId === 'string') {
      const trimmedId = element.actionFlowId.trim();
      if (trimmedId) {
        element.actionFlowId = trimmedId;
      } else {
        delete element.actionFlowId;
      }
    } else {
      delete element.actionFlowId;
    }
    if (typeof element.actionSelector === 'string') {
      const trimmedSelector = element.actionSelector.trim();
      if (trimmedSelector) {
        element.actionSelector = trimmedSelector;
      } else {
        delete element.actionSelector;
      }
    } else {
      delete element.actionSelector;
    }
    if (typeof element.actionFlow === 'string') {
      const trimmedFlow = element.actionFlow.trim();
      if (trimmedFlow) {
        const { definition, error } = parseActionFlowDefinition(trimmedFlow);
        if (error) {
          throw new Error(`Invalid action flow: ${error}`);
        }
        if (definition) {
          element.actionFlow = trimmedFlow;
        } else {
          delete element.actionFlow;
        }
      } else {
        delete element.actionFlow;
      }
    } else {
      delete element.actionFlow;
    }
    if (typeof element.href === 'string') {
      const trimmedHref = element.href.trim();
      if (trimmedHref) {
        element.href = trimmedHref;
      } else {
        delete element.href;
      }
    }
    if (element.href && !element.actionFlow && !element.actionSelector && !element.actionFlowId) {
      throw new Error('Buttons with a URL need an action flow.');
    }
  } else if (element.type === 'area') {
    delete element.actionFlowLocked;
    delete element.actionFlowId;
    delete element.actionSelector;
    delete element.actionFlow;
    delete element.href;
    element.floating = true;
    delete element.containerId;
  } else {
    delete element.actionFlowLocked;
    delete element.actionFlowId;
    delete element.actionSelector;
    delete element.actionFlow;
  }
  if (element.type === 'area') {
    element.layout = element.layout === 'column' ? 'column' : 'row';
  } else {
    delete element.layout;
  }
  if (element.type === 'link' && element.href) {
    element.linkTarget = element.linkTarget === 'same-tab' ? 'same-tab' : 'new-tab';
  } else {
    delete element.linkTarget;
  }
  if (element.containerId) {
    element.floating = false;
  }
  if (Array.isArray(element.frameSelectors)) {
    element.frameSelectors = element.frameSelectors.map((value) => String(value));
  } else {
    delete element.frameSelectors;
  }
  if (typeof element.frameLabel === 'string' && element.frameLabel.trim()) {
    element.frameLabel = element.frameLabel.trim().slice(0, 200);
  } else {
    delete element.frameLabel;
  }
  if (typeof element.frameUrl === 'string' && element.frameUrl.trim()) {
    element.frameUrl = element.frameUrl.trim();
  } else {
    delete element.frameUrl;
  }
  return element;
}

/**
 * 状態更新をサイドパネルおよび同一ページのタブへ配信する。
 * Broadcasts state updates to side panels and matching tabs.
 * @param {string} pageUrl
 * @param {import('./common/types.js').InjectedElement[]} elements
 * @returns {Promise<void>}
 */
async function broadcastState(pageUrl, elements) {
  const normalized = normalizePageUrl(pageUrl);
  if (!normalized) {
    return;
  }

  /** @type {number[]} */
  let targetTabIds = [];
  const cached = pageUrlTabIds.get(normalized);
  if (cached && cached.size > 0) {
    targetTabIds = Array.from(cached);
  } else {
    const tabs = await chrome.tabs.query({});
    const collected = [];
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || !tab.url) {
        continue;
      }
      if (normalizePageUrl(tab.url) === normalized) {
        collected.push(tab.id);
      }
    }
    if (collected.length > 0) {
      pageUrlTabIds.set(normalized, new Set(collected));
      targetTabIds = collected;
    }
  }

  if (targetTabIds.length > 0) {
    await Promise.allSettled(
      targetTabIds.map((tabId) =>
        sendMessageToFrames(tabId, { type: MessageType.REHYDRATE, pageUrl: normalized, data: elements }),
      ),
    );
  }
  try {
    await chrome.runtime.sendMessage({ type: MessageType.REHYDRATE, pageUrl: normalized, data: elements });
  } catch (error) {
    // ignore when no listeners are ready
  }
}

/**
 * Broadcasts a delete event to side panels and matching tabs.
 * @param {string} pageUrl
 * @param {string} elementId
 * @returns {Promise<void>}
 */
async function broadcastDelete(pageUrl, elementId) {
  const normalized = normalizePageUrl(pageUrl);
  if (!normalized || !elementId) {
    return;
  }

  const payload = { id: elementId, pageUrl: normalized };

  /** @type {number[]} */
  let targetTabIds = [];
  const cached = pageUrlTabIds.get(normalized);
  if (cached && cached.size > 0) {
    targetTabIds = Array.from(cached);
  } else {
    const tabs = await chrome.tabs.query({});
    const collected = [];
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || !tab.url) {
        continue;
      }
      if (normalizePageUrl(tab.url) === normalized) {
        collected.push(tab.id);
      }
    }
    if (collected.length > 0) {
      pageUrlTabIds.set(normalized, new Set(collected));
      targetTabIds = collected;
    }
  }

  if (targetTabIds.length > 0) {
    await Promise.allSettled(
      targetTabIds.map((tabId) =>
        sendMessageToFrames(tabId, { type: MessageType.DELETE, pageUrl: normalized, data: payload }),
      ),
    );
  }

  try {
    await chrome.runtime.sendMessage({ type: MessageType.DELETE, pageUrl: normalized, data: payload });
  } catch (error) {
    // ignore when no listeners are ready
  }
}

/**
 * Broadcasts an update event to side panels and matching tabs.
 * @param {string} pageUrl
 * @param {import('./common/types.js').InjectedElement} element
 * @returns {Promise<void>}
 */
async function broadcastUpdate(pageUrl, element) {
  const normalized = normalizePageUrl(pageUrl || element?.siteUrl || element?.pageUrl);
  if (!normalized || !element?.id) {
    return;
  }

  const payload = { ...element };

  /** @type {number[]} */
  let targetTabIds = [];
  const cached = pageUrlTabIds.get(normalized);
  if (cached && cached.size > 0) {
    targetTabIds = Array.from(cached);
  } else {
    const tabs = await chrome.tabs.query({});
    const collected = [];
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || !tab.url) {
        continue;
      }
      if (normalizePageUrl(tab.url) === normalized) {
        collected.push(tab.id);
      }
    }
    if (collected.length > 0) {
      pageUrlTabIds.set(normalized, new Set(collected));
      targetTabIds = collected;
    }
  }

  if (targetTabIds.length > 0) {
    await Promise.allSettled(
      targetTabIds.map((tabId) =>
        sendMessageToFrames(tabId, { type: MessageType.UPDATE, pageUrl: normalized, data: payload }),
      ),
    );
  }

  try {
    await chrome.runtime.sendMessage({ type: MessageType.UPDATE, pageUrl: normalized, data: payload });
  } catch (error) {
    // ignore when no listeners are ready
  }
}

/**
 * タブへメッセージを送信し、失敗時は静かに握りつぶす。
 * Dispatches a message to a tab, ignoring failures quietly.
 * @param {number} tabId
 * @param {unknown} message
 * @returns {Promise<void>}
 */
async function safeSendMessage(tabId, message, frameId) {
  try {
    if (typeof frameId === 'number') {
      await chrome.tabs.sendMessage(tabId, message, { frameId });
    } else {
      await chrome.tabs.sendMessage(tabId, message);
    }
  } catch (error) {
    // Content script might not be injected yet; ignore silently.
  }
}

/**
 * タブ内の全フレームへメッセージを送信し、失敗時はフォールバックする。
 * Sends a message to every frame in the tab, falling back to the top frame on failure.
 * @param {number} tabId
 * @param {unknown} message
 * @returns {Promise<void>}
 */
async function sendMessageToFrames(tabId, message) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    if (!frames || frames.length === 0) {
      await safeSendMessage(tabId, message);
      return;
    }
    await Promise.allSettled(frames.map((frame) => safeSendMessage(tabId, message, frame.frameId)));
  } catch (error) {
    await safeSendMessage(tabId, message);
  }
}

async function sendMessageToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function pushHiddenRulesToTab(tabId, pageUrl) {
  if (!tabId || !pageUrl) return [];
  try {
    const rules = await getEffectiveRules(pageUrl);
    await sendMessageToFrames(tabId, {
      type: MessageType.APPLY_HIDDEN_RULES,
      pageUrl: normalizePageUrl(pageUrl),
      data: { rules },
    });
    return rules;
  } catch (_error) {
    return [];
  }
}

/**
 * ストア内から指定 ID の要素を検索する。
 * Finds an element in storage by page URL and identifier.
 * @param {string} pageUrl
 * @param {string} id
 * @returns {Promise<import('./common/types.js').InjectedElement | null>}
 */
async function findElement(pageUrl, id) {
  if (!pageUrl || !id) {
    return null;
  }
  const list = await getElementsByUrl(pageUrl);
  return list.find((item) => item.id === id) || null;
}

/**
 * ピッカーイベントをリスナーへ転送し、存在しない場合は無視する。
 * Forwards picker events to any listening extension pages.
 * @param {string} type
 * @param {any} payload
 * @returns {Promise<void>}
 */
async function notifyPickerResult(type, payload) {
  try {
    const siteUrl = normalizePageUrl(payload?.siteUrl || payload?.pageUrl);
    await chrome.runtime.sendMessage({ type, pageUrl: siteUrl, data: payload });
  } catch (error) {
    // No side panel listening; ignore silently.
  }
}

/**
 * JSON インポートされたストアデータを検証し、永続化する。
 * Validates and persists an imported store payload.
 * @param {Record<string, unknown>} rawStore
 * @returns {Promise<{ pageCount: number; elementCount: number }>}
 */
async function importStorePayload(rawStore) {
  const parsed = parseTransferPayload(rawStore);
  const normalizedStore = {};
  const flowStore = {};
  const hiddenStore = {};
  let elementCount = 0;
  const includesFlows = Boolean(parsed?.includes?.flows);
  const includesHidden = Boolean(parsed?.includes?.hidden);

  for (const [siteKey, siteData] of Object.entries(parsed.sites || {})) {
    if (!siteData || typeof siteData !== 'object') {
      continue;
    }
    if (siteKey !== 'global') {
      const elements = Array.isArray(siteData.elements) ? siteData.elements : [];
      const sanitized = [];
      for (const entry of elements) {
        if (!entry || typeof entry !== 'object') {
          throw new Error(`Invalid element entry for ${siteKey}.`);
        }
        const providedPage = typeof entry.pageUrl === 'string' ? entry.pageUrl : '';
        const normalizedEntryUrl = providedPage ? normalizePageLocation(providedPage, siteKey).trim() : '';
        const payload = {
          ...entry,
          siteUrl: siteKey,
          pageUrl:
            providedPage && normalizePageUrl(providedPage) === siteKey && providedPage === siteKey
              ? siteKey
              : normalizedEntryUrl || siteKey,
        };
        try {
          const validated = validateElementPayload(payload);
          validated.siteUrl = siteKey;
          sanitized.push(validated);
        } catch (error) {
          throw new Error(`Invalid element for ${siteKey}: ${error.message}`);
        }
      }
      if (sanitized.length > 0) {
        normalizedStore[siteKey] = sanitized;
        elementCount += sanitized.length;
      }
    }

    if (includesFlows && siteKey !== 'global') {
      const flows = Array.isArray(siteData.flows) ? siteData.flows : [];
      if (flows.length > 0) {
        flowStore[siteKey] = flows.map((flow) => {
          if (!flow || typeof flow !== 'object') {
            return flow;
          }
          return { ...flow, pageUrl: siteKey };
        });
      }
    }

    if (includesHidden) {
      const hiddenRules = Array.isArray(siteData.hidden) ? siteData.hidden : [];
      hiddenRules.forEach((rule) => {
        const scope = rule?.scope;
        const providedPage = typeof rule?.pageUrl === 'string' ? rule.pageUrl : '';
        if (siteKey === 'global' || scope === 'global') {
          hiddenStore.global = hiddenStore.global || [];
          hiddenStore.global.push({ ...rule, scope: 'global' });
          return;
        }
        if (scope === 'page') {
          const pageUrl = normalizePageUrl(providedPage || siteKey) || siteKey;
          const key = `page:${pageUrl}`;
          hiddenStore[key] = hiddenStore[key] || [];
          hiddenStore[key].push({ ...rule, scope: 'page', pageUrl });
          return;
        }
        const siteUrl = normalizePageUrl(providedPage || siteKey) || siteKey;
        const key = `site:${siteUrl}`;
        hiddenStore[key] = hiddenStore[key] || [];
        hiddenStore[key].push({ ...rule, scope: 'site', pageUrl: siteUrl });
      });
    }
  }

  await replaceStore(normalizedStore);
  if (includesFlows) {
    await replaceFlowStore(flowStore);
  }
  if (includesHidden) {
    await replaceHiddenStore(hiddenStore);
  }
  return {
    pageCount: Object.keys(normalizedStore).length,
    elementCount,
  };
}

/**
 * ストレージに保存された要素を全タブへ再配信する。
 * Rehydrates open tabs with the persisted store state.
 * @returns {Promise<void>}
 */
async function rehydrateTabsFromStore() {
  try {
    const store = await getFullStore();
    if (!store || typeof store !== 'object') {
      return;
    }
    const tasks = Object.entries(store)
      .filter(([pageUrl]) => Boolean(pageUrl))
      .map(([pageUrl, elements]) => broadcastState(pageUrl, Array.isArray(elements) ? elements : []));
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  } catch (error) {
    console.error('[Ladybrid] Failed to rehydrate tabs from storage', error);
  }
}
