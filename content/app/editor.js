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
      // Live preview and autosave while editing existing elements
      injectModule.previewElement(elementId, updated || {});
      try {
        const baseLatest = injectModule.getElement(elementId) || element;
        const autosavePayload = {
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
        sendMessage(MessageType.UPDATE, autosavePayload).catch(() => {});
        try { dirtyIds.add(elementId); } catch (_e) {}
      } catch (_error) {
        // ignore autosave failures
      }
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
      sendMessage(MessageType.UPDATE, payload).catch((error) =>
        console.error('[PageAugmentor] Failed to update element', error),
      );
      try { dirtyIds.add(elementId); } catch (_e) {}
    },
    onCancel() {
      injectModule.setEditingElement(elementId, false);
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

