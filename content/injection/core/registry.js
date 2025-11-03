import { applyMetadata, flashHighlight, insertHost, clearPendingContainerAttachment } from '../orchestrator/orchestrator.js';
import { createHost } from '../host/create-host.js';
import { HOST_ATTRIBUTE } from './constants.js';

/** @type {Map<string, import('../../../common/types.js').InjectedElement>} */
const elements = new Map();
/** @type {Map<string, HTMLElement>} */
const hosts = new Map();
const editingElements = new Set();
let editingMode = false;

export function ensureElement(element) {
  elements.set(element.id, element);
  let host = hosts.get(element.id);
  if (!host || !host.isConnected) {
    // Adopt an existing DOM host first (avoids accidental duplication)
    const adopted = findExistingHostInDom(element.id);
    if (adopted) {
      host = adopted;
      hosts.set(element.id, host);
      applyMetadata(host, element);
    } else {
      host = createHost(element);
      const inserted = insertHost(host, element);
      if (!inserted) {
        host.remove();
        clearPendingContainerAttachment(element.id);
        return false;
      }
      hosts.set(element.id, host);
    }
  } else {
    applyMetadata(host, element);
  }
  applyEditingState(host, element.id);
  return true;
}

export function updateElement(element) {
  const previous = elements.get(element.id);
  elements.set(element.id, element);
  const host = hosts.get(element.id);
  const locationChanged =
    previous &&
    (previous.selector !== element.selector ||
      previous.position !== element.position ||
      hasAreaPositionChanged(previous, element));
  if (!host || !host.isConnected || locationChanged) {
    if (host?.isConnected) {
      host.remove();
    }
    clearPendingContainerAttachment(element.id);
    hosts.delete(element.id);
    return ensureElement(element);
  }
  applyMetadata(host, element);
  applyEditingState(host, element.id);
  return true;
}

export function removeElement(elementId) {
  elements.delete(elementId);
  const host = hosts.get(elementId);
  clearPendingContainerAttachment(elementId);
  if (host) {
    hosts.delete(elementId);
    host.remove();
    editingElements.delete(elementId);
    return true;
  }
  return false;
}

export function reconcileElements() {
  for (const element of elements.values()) {
    ensureElement(element);
  }
}

export function getElement(elementId) {
  return elements.get(elementId);
}

export function getHost(elementId) {
  const host = hosts.get(elementId);
  return host?.isConnected ? host : null;
}

export function setEditingElement(elementId, editing) {
  if (!elementId) {
    return;
  }
  if (editing) {
    editingElements.add(elementId);
  } else {
    editingElements.delete(elementId);
  }
  const host = hosts.get(elementId);
  if (host?.isConnected) {
    applyEditingState(host, elementId);
  }
}

export function setEditingMode(enabled) {
  editingMode = Boolean(enabled);
  for (const [elementId, host] of hosts.entries()) {
    if (host?.isConnected) {
      applyEditingState(host, elementId);
    }
  }
}

export function previewElement(elementId, overrides) {
  const base = elements.get(elementId);
  if (!base) {
    return;
  }
  const host = hosts.get(elementId);
  if (!host || !host.isConnected) {
    return;
  }
  const merged = {
    ...base,
    ...overrides,
    style: {
      ...(base.style || {}),
      ...(overrides?.style || {}),
    },
  };
  applyMetadata(host, merged);
}

export function focusElement(elementId) {
  const host = hosts.get(elementId);
  if (!host || !host.isConnected) {
    return false;
  }
  host.scrollIntoView({ behavior: 'smooth', block: 'center' });
  flashHighlight(host);
  return true;
}

export function listElements() {
  return Array.from(elements.values());
}

function hasAreaPositionChanged(previous, next) {
  if (!previous || !next || previous.type !== 'area' || next.type !== 'area') {
    return false;
  }
  const prevStyle = previous.style || {};
  const nextStyle = next.style || {};
  const prevLeft = typeof prevStyle.left === 'string' ? prevStyle.left.trim() : '';
  const nextLeft = typeof nextStyle.left === 'string' ? nextStyle.left.trim() : '';
  const prevTop = typeof prevStyle.top === 'string' ? prevStyle.top.trim() : '';
  const nextTop = typeof nextStyle.top === 'string' ? nextStyle.top.trim() : '';
  return prevLeft !== nextLeft || prevTop !== nextTop;
}

function applyEditingState(host, elementId) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  if (editingMode) {
    host.dataset.pageAugmentorGlobalEditing = 'true';
  } else {
    delete host.dataset.pageAugmentorGlobalEditing;
  }
  if (editingMode || editingElements.has(elementId)) {
    host.dataset.pageAugmentorEditing = 'true';
  } else {
    delete host.dataset.pageAugmentorEditing;
  }
}
function escapeAttributeSelector(value) {
  try {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
  } catch (_e) {}
  return String(value).replace(/["\\]/g, '\\$&');
}

function findExistingHostInDom(elementId) {
  try {
    if (!elementId) return null;
    const escaped = escapeAttributeSelector(elementId);
    const node = document.querySelector(`[${HOST_ATTRIBUTE}="${escaped}"]`);
    return node instanceof HTMLElement ? node : null;
  } catch (_e) {
    return null;
  }
}


