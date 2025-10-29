import { applyMetadata, createHost, flashHighlight, insertHost } from './dom.js';

/** @type {Map<string, import('../../common/types.js').InjectedElement>} */
const elements = new Map();
/** @type {Map<string, HTMLElement>} */
const hosts = new Map();
const editingElements = new Set();

export function ensureElement(element) {
  elements.set(element.id, element);
  let host = hosts.get(element.id);
  if (!host || !document.contains(host)) {
    host = createHost(element);
    const inserted = insertHost(host, element);
    if (!inserted) {
      host.remove();
      return false;
    }
    hosts.set(element.id, host);
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
  if (!host || !document.contains(host) || locationChanged) {
    if (host && document.contains(host)) {
      host.remove();
    }
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
  return host && document.contains(host) ? host : null;
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
  if (host && document.contains(host)) {
    applyEditingState(host, elementId);
  }
}

export function previewElement(elementId, overrides) {
  const base = elements.get(elementId);
  if (!base) {
    return;
  }
  const host = hosts.get(elementId);
  if (!host || !document.contains(host)) {
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
  if (!host || !document.contains(host)) {
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
  if (editingElements.has(elementId)) {
    host.dataset.pageAugmentorEditing = 'true';
  } else {
    delete host.dataset.pageAugmentorEditing;
  }
}
