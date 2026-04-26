import {
  MessageType,
  type RuntimeMessage,
} from '../../shared/messages';
import { type StructuredElementRecord } from '../../shared/siteDataSchema';
import {
  toStructuredElementPayload,
} from './injection/shared';
import {
  HIGHLIGHT_COLOR,
  type RuntimeMessenger,
} from './injection/types';
import { registry } from './injection/registry';
import {
  injectElement,
  rehydrateElements,
  removeElement,
  resetAllInjectionState,
  setEditingElement,
  upsertElement,
} from './injection/reconciler';

const blinkHighlight = (node: HTMLElement) => {
  const rect = node.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.boxSizing = 'border-box';
  overlay.style.background = HIGHLIGHT_COLOR;
  overlay.style.backdropFilter = 'saturate(1.1)';
  overlay.style.border = '2px solid rgba(27, 132, 255, 0.65)';
  overlay.style.zIndex = '2147483646';
  overlay.style.top = `${Math.round(rect.top) - 5}px`;
  overlay.style.left = `${Math.round(rect.left) - 5}px`;
  overlay.style.width = `${Math.round(rect.width) + 10}px`;
  overlay.style.height = `${Math.round(rect.height) + 10}px`;
  overlay.style.opacity = '0.38';
  overlay.style.transition = 'opacity 100ms ease, transform 100ms ease';
  overlay.style.transform = 'scale(1)';
  document.body.appendChild(overlay);

  let visible = true;
  let ticks = 0;
  const timer = window.setInterval(() => {
    visible = !visible;
    overlay.style.opacity = visible ? '0.38' : '0.08';
    overlay.style.transform = visible ? 'scale(1)' : 'scale(0.995)';
    ticks += 1;
    if (ticks >= 6) {
      window.clearInterval(timer);
      overlay.remove();
    }
  }, 120);
};

const highlightElement = (id: string) => {
  const entry = registry.get(id);
  if (!entry?.node) {
    return false;
  }
  const preferred = entry.content || entry.node;
  const preferredRect = preferred.getBoundingClientRect();
  const target =
    preferredRect.width > 0 && preferredRect.height > 0
      ? preferred
      : entry.node;
  const rect = target.getBoundingClientRect();
  const nextTop = rect.top + window.scrollY - (window.innerHeight - rect.height) / 2;
  const nextLeft = rect.left + window.scrollX - (window.innerWidth - rect.width) / 2;
  window.scrollTo({
    top: Math.max(0, Math.round(nextTop)),
    left: Math.max(0, Math.round(nextLeft)),
    behavior: 'auto',
  });
  requestAnimationFrame(() => {
    blinkHighlight(target);
  });
  return true;
};

export const handleInjectionMessage = (message: RuntimeMessage) => {
  switch (message.type) {
    case MessageType.CREATE_ELEMENT: {
      const element = toStructuredElementPayload(message.data?.element);
      if (!element) {
        return { ok: false, error: 'invalid-element' };
      }
      return injectElement(element);
    }
    case MessageType.UPDATE_ELEMENT:
    case MessageType.PREVIEW_ELEMENT: {
      const element = toStructuredElementPayload(message.data?.element);
      if (!element) {
        return { ok: false, error: 'invalid-element' };
      }
      return upsertElement(element);
    }
    case MessageType.DELETE_ELEMENT: {
      const id = message.data?.id;
      if (!id) {
        return { ok: false, error: 'invalid-element-id' };
      }
      removeElement(id);
      return { ok: true };
    }
    case MessageType.REHYDRATE_ELEMENTS: {
      const elements = Array.isArray(message.data?.elements)
        ? message.data.elements
            .map((entry) => toStructuredElementPayload(entry))
            .filter((entry): entry is StructuredElementRecord => Boolean(entry))
        : [];
      rehydrateElements(elements);
      return { ok: true };
    }
    case MessageType.FOCUS_ELEMENT: {
      const id = message.data?.id;
      if (!id) {
        return { ok: false, error: 'invalid-element-id' };
      }
      const focused = highlightElement(id);
      return { ok: focused, error: focused ? undefined : 'element-not-found' };
    }
    case MessageType.SET_EDITING_ELEMENT: {
      setEditingElement(message.data?.id);
      return { ok: true };
    }
    default:
      return undefined;
  }
};

export const resetInjectionRegistry = () => {
  resetAllInjectionState();
};

export const registerPageContextIfNeeded = (runtime?: RuntimeMessenger) => {
  if (!runtime?.sendMessage) {
    return;
  }
  if (window.top !== window) {
    return;
  }
  const href = window.location.href;
  if (!href) {
    return;
  }
  runtime.sendMessage({
    type: MessageType.PAGE_CONTEXT_PING,
    data: { url: href, title: document.title || undefined },
  });
};
