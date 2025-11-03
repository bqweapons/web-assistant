import { HOST_ATTRIBUTE, Z_INDEX_FLOATING_DEFAULT, Z_INDEX_HOST_DEFAULT } from '../../core/index.js';

export const AREA_DRAG_THRESHOLD = 4;

export function isEditingAllowed(host) {
  return (
    host?.dataset?.pageAugmentorEditing === 'true' ||
    host?.dataset?.pageAugmentorGlobalEditing === 'true'
  );
}

export function setPointerCaptureSafe(el, pointerId) {
  if (pointerId == null) return;
  try {
    el.setPointerCapture(pointerId);
  } catch (_e) {}
}

export function releasePointerCaptureSafe(el, pointerId) {
  if (pointerId == null) return;
  try {
    el.releasePointerCapture(pointerId);
  } catch (_e) {}
}

export function getHostFromNode(node) {
  const root = node?.getRootNode?.();
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    return root.host;
  }
  return null;
}

export function getHostRectScreen(host) {
  const rect = host.getBoundingClientRect();
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

export function setHostPosition(host, left, top) {
  host.style.left = `${Math.round(left)}px`;
  host.style.top = `${Math.round(top)}px`;
}

export function buildAbsoluteStyle(previousStyle, left, top) {
  const base = previousStyle || {};
  const zIndex = base.zIndex && String(base.zIndex).trim() ? String(base.zIndex).trim() : Z_INDEX_FLOATING_DEFAULT;
  return {
    ...base,
    position: 'absolute',
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    zIndex,
  };
}

export function dispatchDraftUpdateFromHost(host, detail) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const elementId = host.getAttribute(HOST_ATTRIBUTE);
  const payload = {
    ...(detail || {}),
  };
  if (!payload.elementId && elementId) {
    payload.elementId = elementId;
  }
  host.dispatchEvent(
    new CustomEvent('page-augmentor-draft-update', {
      detail: payload,
      bubbles: true,
      composed: true,
    }),
  );
}

export function positionFloatingHost(host, element, target) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const style = element?.style || {};
  const hasAbsolute = typeof style.position === 'string' && style.position.trim().toLowerCase() === 'absolute';
  const left = typeof style.left === 'string' ? style.left.trim() : '';
  const top = typeof style.top === 'string' ? style.top.trim() : '';

  host.style.position = 'absolute';
  host.style.zIndex = typeof style.zIndex === 'string' && style.zIndex.trim() ? style.zIndex : Z_INDEX_HOST_DEFAULT;
  host.style.width = '';
  host.style.height = '';

  if (hasAbsolute && left && top) {
    host.style.left = left;
    host.style.top = top;
    return;
  }

  const reference = target instanceof Element ? target.getBoundingClientRect() : null;
  if (reference) {
    host.style.left = `${reference.left + window.scrollX + 16}px`;
    host.style.top = `${reference.top + window.scrollY + 16}px`;
  } else {
    host.style.left = `${window.scrollX + 120}px`;
    host.style.top = `${window.scrollY + 120}px`;
  }
}



