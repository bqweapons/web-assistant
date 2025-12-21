import { HOST_ATTRIBUTE } from '../injection/core/constants.js';
import * as injectModule from '../inject.js';
import { sendMessage, MessageType } from '../common/messaging.js';
import { state, dirtyIds, runtime } from './context.js';
import { closeEditorBubble } from './editor.js';

function resolveHostFromEvent(event) {
  if (!event || typeof event.composedPath !== 'function') {
    return null;
  }
  const path = event.composedPath();
  for (const node of path) {
    if (node instanceof HTMLElement) {
      // Ignore clicks inside our own UI (bubbles/overlays)
      if (node.dataset?.pageAugmentorRoot) {
        return null;
      }
      // Direct host hit
      if (node.hasAttribute(HOST_ATTRIBUTE)) {
        return node;
      }
      try {
        const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
        if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
          const host = root.host;
          if (host.hasAttribute(HOST_ATTRIBUTE)) {
            return host;
          }
        }
      } catch (_e) {}
    }
  }
  return null;
}

function handleEditingClick(event) {
  if (!state.editingMode) {
    return;
  }
  const host = resolveHostFromEvent(event);
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const elementId = host.getAttribute(HOST_ATTRIBUTE);
  if (!elementId) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
  if (state.activeEditorElementId && state.activeEditorElementId === elementId && state.editorSession) {
    return;
  }
  sendMessage(MessageType.OPEN_ELEMENT_DRAWER, { id: elementId, pageUrl: runtime.pageUrl }).catch(() => {});
}

export function applyEditingMode(enabled) {
  const next = Boolean(enabled);
  injectModule.setEditingMode(next);
  if (state.editingMode === next) {
    return;
  }
  state.editingMode = next;
  if (next) {
    document.addEventListener('click', handleEditingClick, true);
  } else {
    document.removeEventListener('click', handleEditingClick, true);
    try {
      const lastEditingId = state.activeEditorElementId || null;
      closeEditorBubble();
      const idsToPersist = new Set(dirtyIds);
      if (lastEditingId) idsToPersist.add(lastEditingId);
      idsToPersist.forEach((id) => {
        const latest = injectModule.getElement(id);
        if (latest) {
          const payload = {
            ...latest,
            id,
            siteUrl: runtime.siteKey || runtime.pageUrl,
            pageUrl: latest.pageUrl || runtime.pageKey || runtime.pageUrl,
            updatedAt: Date.now(),
          };
          sendMessage(MessageType.UPDATE, payload).catch(() => {});
        }
      });
      dirtyIds.clear();
    } catch (_error) {
      // ignore cleanup failures
    }
  }
}
