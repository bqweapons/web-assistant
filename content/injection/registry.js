import { applyMetadata, createHost, flashHighlight, insertHost } from './dom.js';

/** @type {Map<string, import('../../common/types.js').InjectedElement>} */
const elements = new Map();
/** @type {Map<string, HTMLElement>} */
const hosts = new Map();

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
  return true;
}

export function updateElement(element) {
  elements.set(element.id, element);
  const host = hosts.get(element.id);
  if (!host || !document.contains(host)) {
    return ensureElement(element);
  }
  applyMetadata(host, element);
  return true;
}

export function removeElement(elementId) {
  elements.delete(elementId);
  const host = hosts.get(elementId);
  if (host) {
    hosts.delete(elementId);
    host.remove();
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
