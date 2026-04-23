import {
  MessageType,
  type FlowRecordingEventPayload,
  type FlowRecordingStartPayload,
  type FlowRecordingStatusPayload,
} from '../../shared/messages';
import { generateSelector } from './injection/selector';

const RECORDER_OVERLAY_ATTR = 'data-flow-recorder-overlay';
const LADYBIRD_ELEMENT_ATTR = 'data-ladybird-element';
const INPUT_TYPES = new Set([
  'text',
  'password',
  'email',
  'number',
  'search',
  'url',
  'tel',
  'date',
  'datetime-local',
  'time',
  'month',
  'week',
  'color',
]);

type InputKind = FlowRecordingEventPayload['inputKind'];

type FlowRecorderSession = {
  sessionId: string;
  stop: (reason?: string, emitStatus?: boolean) => void;
};

let currentSession: FlowRecorderSession | null = null;

type PendingInputState = {
  selector: string;
  value: string;
  inputKind: Exclude<InputKind, 'password' | null>;
};

const sendRuntimeMessageSafe = (message: {
  type: MessageType;
  data: FlowRecordingEventPayload | FlowRecordingStatusPayload;
}) => {
  const runtime = chrome?.runtime;
  if (!runtime?.sendMessage) {
    return;
  }
  try {
    runtime.sendMessage(message, () => {
      void runtime.lastError;
    });
  } catch {
    // Ignore best-effort recorder telemetry failures.
  }
};

const createOverlay = () => {
  const container = document.createElement('div');
  container.setAttribute(RECORDER_OVERLAY_ATTR, 'true');
  Object.assign(container.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: '2147483646',
    pointerEvents: 'none',
    padding: '8px 10px',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.9)',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: '600',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.2)',
  });
  container.textContent = 'Ladybird recording';
  return {
    mount() {
      (document.body || document.documentElement).appendChild(container);
    },
    dispose() {
      container.remove();
    },
  };
};

const shouldIgnoreTarget = (target: EventTarget | null): target is null => {
  if (!(target instanceof Element)) {
    return true;
  }
  if (target.closest(`[${RECORDER_OVERLAY_ATTR}]`)) {
    return true;
  }
  if (target.closest('[data-picker-overlay]')) {
    return true;
  }
  if (target.closest(`[${LADYBIRD_ELEMENT_ATTR}]`)) {
    return true;
  }
  return false;
};

const resolveTarget = (target: EventTarget | null) => {
  if (shouldIgnoreTarget(target)) {
    return null;
  }
  return target instanceof Element ? target : null;
};

// 2.3 — Treat autocomplete-tagged sensitive fields as 'password' for
// recording purposes. Mirrors isSensitiveInputElement in flowRunner.ts
// (batch 5 / 1.6) so the two surfaces agree on what counts as sensitive.
// Catches real-world cases where type='text' with a "show password" toggle
// still carries autocomplete='current-password' / 'new-password', plus
// credit-card and OTP fields that are NOT type='password'. Limits mirror
// 1.6: selector-based heuristics (#password, [name*="password"]) are
// intentionally NOT used; element-level autocomplete is authoritative.
const hasSensitiveAutocomplete = (element: HTMLInputElement): boolean => {
  const autocomplete = (element.autocomplete || '').toLowerCase();
  if (!autocomplete) {
    return false;
  }
  return (
    autocomplete.includes('password') ||
    autocomplete.includes('cc-number') ||
    autocomplete.includes('cc-csc') ||
    autocomplete.includes('one-time-code')
  );
};

const getInputKind = (element: Element): InputKind | null => {
  if (element instanceof HTMLElement && element.isContentEditable) {
    return 'contenteditable';
  }
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea') {
    return 'textarea';
  }
  if (tag === 'select') {
    return 'select';
  }
  if (tag !== 'input') {
    return null;
  }
  const type = (element.getAttribute('type') || 'text').toLowerCase();
  if (!INPUT_TYPES.has(type)) {
    return null;
  }
  if (type === 'password') {
    return 'password';
  }
  if (element instanceof HTMLInputElement && hasSensitiveAutocomplete(element)) {
    return 'password';
  }
  return 'text';
};

const getInputValue = (element: Element) => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  if (element instanceof HTMLSelectElement) {
    return element.value;
  }
  if (element instanceof HTMLElement && element.isContentEditable) {
    return element.innerText;
  }
  return '';
};

const isTextEntryTarget = (element: Element) => {
  const kind = getInputKind(element);
  return kind === 'text' || kind === 'textarea' || kind === 'select' || kind === 'contenteditable' || kind === 'password';
};

const createEventId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const startFlowRecorder = (payload: FlowRecordingStartPayload) => {
  if (currentSession) {
    currentSession.stop('restarted', false);
  }

  const overlay = createOverlay();
  overlay.mount();

  let disposed = false;
  let lastUrl = window.location.href;
  let lastClickSignature = '';
  let lastClickAt = 0;
  let lastInputSignature = '';
  let lastInputAt = 0;
  let pendingInput: PendingInputState | null = null;

  const sendEvent = (data: Omit<FlowRecordingEventPayload, 'sessionId' | 'eventId' | 'timestamp' | 'url'>) => {
    sendRuntimeMessageSafe({
      type: MessageType.FLOW_RECORDING_EVENT,
      data: {
        sessionId: payload.sessionId,
        eventId: createEventId(data.type),
        timestamp: Date.now(),
        url: window.location.href,
        ...data,
      },
    });
  };

  const sendStatus = (state: FlowRecordingStatusPayload['state'], reason?: string) => {
    sendRuntimeMessageSafe({
      type: MessageType.FLOW_RECORDING_STATUS,
      data: {
        sessionId: payload.sessionId,
        state,
        reason,
        url: window.location.href,
      },
    });
  };

  const flushPendingInput = () => {
    if (!pendingInput) {
      return;
    }
    const signature = `input:${pendingInput.selector}:${pendingInput.value}`;
    const now = Date.now();
    if (signature !== lastInputSignature || now - lastInputAt >= 500) {
      lastInputSignature = signature;
      lastInputAt = now;
      sendEvent({
        type: 'input',
        selector: pendingInput.selector,
        value: pendingInput.value,
        inputKind: pendingInput.inputKind,
      });
    }
    pendingInput = null;
  };

  const stop = (reason?: string, emitStatus = true) => {
    if (disposed) {
      return;
    }
    disposed = true;
    flushPendingInput();
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInputActivity, true);
    document.removeEventListener('change', handleInput, true);
    document.removeEventListener('blur', handleInput, true);
    window.removeEventListener('popstate', handleNavigation, true);
    window.removeEventListener('hashchange', handleNavigation, true);
    window.removeEventListener('pagehide', handlePageHide, true);
    restorePushState();
    restoreReplaceState();
    overlay.dispose();
    if (currentSession?.sessionId === payload.sessionId) {
      currentSession = null;
    }
    if (emitStatus) {
      sendStatus(reason === 'navigation' ? 'error' : 'stopped', reason);
    }
  };

  const recordNavigation = () => {
    if (disposed) {
      return;
    }
    const nextUrl = window.location.href;
    if (!nextUrl || nextUrl === lastUrl) {
      return;
    }
    lastUrl = nextUrl;
    sendEvent({
      type: 'navigation-noted',
      message: 'Navigation detected. Recording stopped without adding a navigate step.',
    });
    stop('navigation');
  };

  const wrapHistory = (method: 'pushState' | 'replaceState') => {
    const original = history[method];
    if (typeof original !== 'function') {
      return () => undefined;
    }
    history[method] = function patched(this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      recordNavigation();
      return result;
    } as typeof original;
    return () => {
      history[method] = original;
    };
  };

  const restorePushState = wrapHistory('pushState');
  const restoreReplaceState = wrapHistory('replaceState');

  const handleNavigation = () => {
    recordNavigation();
  };

  const handlePageHide = () => {
    if (disposed) {
      return;
    }
    sendEvent({
      type: 'navigation-noted',
      message: 'Navigation detected. Recording stopped without adding a navigate step.',
    });
    stop('navigation');
  };

  const handleClick = (event: MouseEvent) => {
    const target = resolveTarget(event.target);
    if (!target) {
      return;
    }
    if (isTextEntryTarget(target)) {
      return;
    }
    let selector = '';
    try {
      selector = generateSelector(target);
    } catch {
      return;
    }
    if (!selector) {
      return;
    }
    const signature = `click:${selector}`;
    const now = Date.now();
    if (signature === lastClickSignature && now - lastClickAt < 300) {
      return;
    }
    lastClickSignature = signature;
    lastClickAt = now;
    sendEvent({
      type: 'click',
      selector,
    });
  };

  const handleInput = (event: Event) => {
    const target = resolveTarget(event.target);
    if (!target) {
      return;
    }
    const kind = getInputKind(target);
    if (!kind) {
      return;
    }
    let selector = '';
    try {
      selector = generateSelector(target);
    } catch {
      return;
    }
    if (!selector) {
      return;
    }
    if (kind === 'password') {
      pendingInput = null;
      const now = Date.now();
      const signature = `password:${selector}`;
      if (signature === lastInputSignature && now - lastInputAt < 500) {
        return;
      }
      lastInputSignature = signature;
      lastInputAt = now;
      sendEvent({
        type: 'password-skipped',
        selector,
        inputKind: 'password',
        message: 'Password inputs are skipped. Bind a Password Vault secret manually.',
      });
      return;
    }
    const value = getInputValue(target).trimEnd();
    pendingInput = null;
    const signature = `input:${selector}:${value}`;
    const now = Date.now();
    if (signature === lastInputSignature && now - lastInputAt < 500) {
      return;
    }
    lastInputSignature = signature;
    lastInputAt = now;
    sendEvent({
      type: 'input',
      selector,
      value,
      inputKind: kind,
    });
  };

  const handleInputActivity = (event: Event) => {
    const target = resolveTarget(event.target);
    if (!target) {
      return;
    }
    const kind = getInputKind(target);
    if (!kind || kind === 'password') {
      return;
    }
    let selector = '';
    try {
      selector = generateSelector(target);
    } catch {
      return;
    }
    if (!selector) {
      return;
    }
    pendingInput = {
      selector,
      value: getInputValue(target).trimEnd(),
      inputKind: kind,
    };
  };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInputActivity, true);
  document.addEventListener('change', handleInput, true);
  document.addEventListener('blur', handleInput, true);
  window.addEventListener('popstate', handleNavigation, true);
  window.addEventListener('hashchange', handleNavigation, true);
  window.addEventListener('pagehide', handlePageHide, true);

  currentSession = {
    sessionId: payload.sessionId,
    stop,
  };
};

export const stopFlowRecorder = (sessionId?: string) => {
  if (!currentSession) {
    return false;
  }
  if (sessionId && currentSession.sessionId !== sessionId) {
    return false;
  }
  currentSession.stop('stopped');
  return true;
};
