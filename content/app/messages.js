/* eslint-disable no-undef */
import { runtime } from './context.js';
import { beginPicker } from './picker.js';
import { beginCreationSession } from './creation.js';
import { stopPicker } from './picker.js';
import { openEditorBubble } from './editor.js';
import { applyEditingMode } from './editing-mode.js';
import { matchesFrameSelectors, elementMatchesFrame } from './frame.js';
import { synchronizeElements } from './hydration.js';
import * as injectModule from '../inject.js';
import { MessageType, sendMessage } from '../common/messaging.js';
import { executeActionFlow } from '../injection/core/flow-runner.js';
import { showHUD } from './hud.js';
import { getMessage } from './i18n.js';
import { applyHiddenRules } from './hidden.js';

let executorRegistered = false;

async function registerExecutor() {
  if (executorRegistered) {
    return;
  }
  try {
    await sendMessage(MessageType.REGISTER_EXECUTOR, {
      pageKey: runtime.pageKey,
      capabilities: { flowVersion: 1 },
    });
    executorRegistered = true;
  } catch (error) {
    // registration may fail if background not ready; ignore and retry later
    executorRegistered = false;
  }
}

async function hydrateHiddenRules() {
  try {
    const rules = await sendMessage(MessageType.LIST_HIDDEN_RULES, { pageUrl: runtime.pageUrl, effective: true });
    applyHiddenRules(Array.isArray(rules) ? rules : []);
  } catch (_error) {
    // ignore
  }
}

async function handleRunStep(message) {
  await registerExecutor();
  const { flowId, stepId, stepPayload, definition, steps, timeout, timeoutMs } = message?.data || {};
  const payload =
    stepPayload ||
    (Array.isArray(steps) && steps.length > 0 ? steps[0] : null) ||
    (definition && Array.isArray(definition.steps) && definition.steps.length > 0 ? definition.steps[0] : null);
  if (!payload) {
    const error = { code: 'INVALID_STEP', message: 'Missing step payload.' };
    await sendMessage(MessageType.STEP_ERROR, { flowId, stepId, ...error });
    return { ok: false, error };
  }
  const host = document.body || document.documentElement;
  const timeoutValue = Number(timeout ?? timeoutMs ?? stepPayload?.timeout ?? stepPayload?.timeoutMs ?? 0);
  const retries = Math.max(0, Number.isFinite(Number(stepPayload?.retry)) ? Number(stepPayload.retry) : 0);

  const runOnceWithTimeout = async () => {
    if (timeoutValue > 0) {
      return Promise.race([
        executeActionFlow(host, { steps: [payload], stepCount: 1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Step timeout exceeded')), timeoutValue)),
      ]);
    }
    return executeActionFlow(host, { steps: [payload], stepCount: 1 });
  };

  try {
    let attempt = 0;
    let performed = false;
    let lastError = null;
    while (attempt <= retries) {
      try {
        performed = Boolean(await runOnceWithTimeout());
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt > retries) {
          break;
        }
      }
    }
    if (lastError) {
      throw lastError;
    }
    const result = { performed };
    try {
      await sendMessage(MessageType.STEP_DONE, { flowId, stepId, result, status: 'running' });
    } catch (_error) {
      // background may be unreachable; ignore
    }
    return { ok: true, data: result };
  } catch (error) {
    const code =
      error?.code ||
      (error?.message === 'Step timeout exceeded' ? 'STEP_TIMEOUT' : error?.message ? 'EXECUTION_FAILED' : 'EXECUTION_FAILED');
    const detail = { message: error?.message || String(error), code };
    try {
      await sendMessage(MessageType.STEP_ERROR, {
        flowId,
        stepId,
        code,
        message: detail.message,
        detail,
      });
    } catch (_sendError) {
      // ignore send error
    }
    return { ok: false, error: detail };
  }
}

export function setupMessageBridge() {
  registerExecutor();
  hydrateHiddenRules();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) {
      return;
    }
    if (message.pageUrl && message.pageUrl !== runtime.pageUrl) {
      return;
    }
    switch (message.type) {
      case MessageType.REHYDRATE: {
        synchronizeElements(message.data || []);
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.UPDATE: {
        if (message.data && elementMatchesFrame(message.data)) {
          injectModule.updateElement(message.data);
        } else if (message.data?.id) {
          const existing = injectModule.getElement(message.data.id);
          if (existing && elementMatchesFrame(existing)) {
            injectModule.updateElement({ ...existing, ...message.data });
          }
        }
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.DELETE: {
        if (message.data?.id) {
          if (elementMatchesFrame(message.data)) {
            injectModule.removeElement(message.data.id);
          } else {
            const existing = injectModule.getElement(message.data.id);
            if (existing && elementMatchesFrame(existing)) {
              injectModule.removeElement(message.data.id);
            }
          }
        }
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.FOCUS_ELEMENT: {
        if (message.data?.id && matchesFrameSelectors(message.data.frameSelectors)) {
          const success = injectModule.focusElement(message.data.id);
          sendResponse?.({ ok: success });
        }
        break;
      }
      case MessageType.START_PICKER: {
        beginPicker(message.data || {});
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.INIT_CREATE: {
        beginCreationSession(message.data || {});
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.CANCEL_PICKER: {
        stopPicker();
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.OPEN_EDITOR: {
        if (message.data?.id && matchesFrameSelectors(message.data.frameSelectors)) {
          const opened = openEditorBubble(message.data.id);
          sendResponse?.({ ok: opened });
        }
        break;
      }
      case MessageType.SET_EDIT_MODE: {
        applyEditingMode(Boolean(message.data?.enabled));
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.APPLY_HIDDEN_RULES: {
        const rules = message?.data?.rules || [];
        applyHiddenRules(Array.isArray(rules) ? rules : []);
        sendResponse?.({ ok: true });
        break;
      }
      case MessageType.RUN_STEP: {
        if (message?.data?.flowId) {
          const { currentIndex, total } = message.data || {};
          const progress =
            Number.isFinite(currentIndex) && Number.isFinite(total) ? ` (${currentIndex + 1}/${total})` : '';
          showHUD(`${getMessage('hud_running_step', 'Running flow step')}${progress}`, 'info');
        }
        handleRunStep(message).then(sendResponse);
        return true;
      }
      case MessageType.STEP_ERROR: {
        // Let HUD or other UI show error; simply ack here.
        if (message?.data?.message) {
          const code = message.data.code ? ` (${message.data.code})` : '';
          showHUD(`${message.data.message}${code}`, 'error');
        }
        sendResponse?.({ ok: true, data: message.data });
        break;
      }
      case MessageType.STEP_DONE: {
        const status = message?.data?.status;
        if (status === 'finished') {
          showHUD(getMessage('hud_flow_finished', 'Flow finished'), 'info');
        } else if (status === 'waiting') {
          showHUD(getMessage('hud_waiting_navigation', 'Waiting for navigation…'), 'info');
        } else if (status === 'paused') {
          showHUD(getMessage('hud_flow_paused', 'Flow paused'), 'warning');
        } else if (status === 'running') {
          showHUD(getMessage('hud_flow_resumed', 'Flow resumed'), 'info');
        } else if (status === 'stopped') {
          showHUD(getMessage('hud_flow_stopped', 'Flow stopped'), 'warning');
        } else {
          showHUD(getMessage('hud_step_completed', 'Step completed'), 'info');
        }
        sendResponse?.({ ok: true, data: message.data });
        break;
      }
      case MessageType.REJOIN_FLOW: {
        if (message?.data?.status === 'waiting') {
          showHUD(getMessage('hud_rejoin_waiting', 'Restored flow; waiting for navigation…'), 'info');
        }
        sendResponse?.({ ok: true, data: { pageKey: runtime.pageKey, pageUrl: runtime.pageUrl } });
        break;
      }
      default:
        break;
    }
    return true;
  });
}
