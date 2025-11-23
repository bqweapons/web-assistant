import * as injectModule from '../inject.js';
import * as selectorModule from '../selector.js';
import { sendMessage, MessageType } from '../common/messaging.js';
import { state, dirtyIds, runtime } from './context.js';

export function openEditorBubble(elementId) {
  closeEditorBubble();
  const element = injectModule.getElement(elementId);
  if (!element) {
    console.warn('[PageAugmentor] Requested editor for unknown element', elementId);
    return false;
  }
  let host = injectModule.getHost(elementId);
  if (!host) {
    const ensured = injectModule.ensureElement(element);
    if (!ensured) {
      console.warn('[PageAugmentor] Unable to ensure element before opening editor', elementId);
      return false;
    }
    host = injectModule.getHost(elementId);
  }
  if (!host) {
    console.warn('[PageAugmentor] Host element not found for editor', elementId);
    return false;
  }
  state.activeEditorElementId = elementId;
  injectModule.setEditingElement(elementId, true);
  const session = selectorModule.openElementEditor({
    target: host,
    selector: element.selector,
    values: element,
    onPreview(updated) {
      // Live preview only; autosave during edit preview is disabled
      injectModule.previewElement(elementId, updated || {});
    },
    onSubmit(updated) {
      injectModule.previewElement(elementId, updated || {});
      state.activeEditorElementId = null;
      injectModule.setEditingElement(elementId, false);
      closeEditorBubble();
      const baseLatest = injectModule.getElement(elementId) || element;
      const payload = {
        ...baseLatest,
        ...(updated || {}),
        style: {
          ...((baseLatest && baseLatest.style) || {}),
          ...(((updated || {}).style) || {}),
        },
        id: elementId,
        pageUrl: runtime.pageUrl,
        updatedAt: Date.now(),
      };
      // Normalize container/floating so drag-out/attach state persists.
      if (updated && Object.prototype.hasOwnProperty.call(updated, 'containerId')) {
        const nextContainer =
          typeof updated.containerId === 'string' ? updated.containerId.trim() : '';
        if (nextContainer) {
          payload.containerId = nextContainer;
          payload.floating = false;
        } else {
          delete payload.containerId;
          if (Object.prototype.hasOwnProperty.call(updated, 'floating')) {
            payload.floating = Boolean(updated.floating);
          } else {
            payload.floating = true;
          }
        }
      } else if (updated && Object.prototype.hasOwnProperty.call(updated, 'floating')) {
        payload.floating = Boolean(updated.floating);
        if (payload.floating) {
          delete payload.containerId;
        }
      }
      // Reflect the latest payload into the local registry immediately so that
      // subsequent editor openings see the saved state (e.g., tooltipPosition).
      try {
        injectModule.updateElement(payload);
      } catch (_e) {}
      sendMessage(MessageType.UPDATE, payload).catch((error) =>
        console.error('[PageAugmentor] Failed to update element', error),
      );
      try { dirtyIds.add(elementId); } catch (_e) {}
    },
    onCancel() {
      // Exit editing state and revert any live preview back to the persisted base
      try {
        injectModule.setEditingElement(elementId, false);
        // Revert shadow content/styles first
        injectModule.previewElement(elementId, {});
        // Force host re-hydration to undo any transient host-level changes (e.g., floating position)
        const base = injectModule.getElement(elementId);
        const host = injectModule.getHost(elementId);
        if (host) {
          try { host.remove(); } catch (_e) {}
        }
        if (base) {
          try { injectModule.ensureElement(base); } catch (_e) {}
        }
      } catch (_e) {}
      closeEditorBubble();
    },
  });
  state.editorSession = session;
  injectModule.focusElement(elementId);
  return true;
}

export function closeEditorBubble() {
  if (state.editorSession) {
    try {
      state.editorSession.close();
    } catch (error) {
      console.warn('[PageAugmentor] Failed to close editor bubble', error);
    }
    state.editorSession = null;
  }
  if (state.activeEditorElementId) {
    try {
      injectModule.setEditingElement(state.activeEditorElementId, false);
      injectModule.previewElement(state.activeEditorElementId, {});
    } catch (error) {
      console.warn('[PageAugmentor] Failed to reset preview element', error);
    }
    state.activeEditorElementId = null;
  }
  if (state.creationElementId) {
    cancelCreationDraft();
  }
}

export function cancelCreationDraft() {
  if (!state.creationElementId) {
    return;
  }
  const draftId = state.creationElementId;
  state.creationElementId = null;
  if (state.activeEditorElementId === draftId) {
    state.activeEditorElementId = null;
  }
  try {
    injectModule.setEditingElement(draftId, false);
  } catch (_error) {
    // ignore editing cleanup failures
  }
  try {
    injectModule.removeElement(draftId);
  } catch (_error) {
    // ignore removal failures
  }
}
