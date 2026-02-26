import * as injectModule from '../inject.js';
import { state } from './context.js';

export function closeEditorBubble() {
  if (state.editorSession) {
    try {
      state.editorSession.close();
    } catch (error) {
      console.warn('[Ladybrid] Failed to close editor bubble', error);
    }
    state.editorSession = null;
  }
  if (state.activeEditorElementId) {
    try {
      injectModule.setEditingElement(state.activeEditorElementId, false);
      injectModule.previewElement(state.activeEditorElementId, {});
    } catch (error) {
      console.warn('[Ladybrid] Failed to reset preview element', error);
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
