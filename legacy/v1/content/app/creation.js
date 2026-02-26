/* eslint-disable no-undef */
import * as selectorModule from '../selector.js';
import * as injectModule from '../inject.js';
import { t } from '../../common/i18n.js';
import { Z_INDEX_FLOATING_DEFAULT } from '../injection/core/constants.js';
import { sendMessage, MessageType } from '../common/messaging.js';
import { highlightPlacementTarget } from './highlight.js';
import { state, runtime, refreshPageContextFromLocation } from './context.js';
import { cancelCreationDraft, closeEditorBubble } from './editor.js';
import { stopPicker } from './picker.js';

export function buildDraftElement(type, scope = 'page') {
  refreshPageContextFromLocation();
  const normalized = type === 'link' || type === 'tooltip' || type === 'area' ? type : 'button';
  const id = crypto.randomUUID();
  const now = Date.now();
  const viewportWidth = Math.max(window.innerWidth || 0, 320);
  const viewportHeight = Math.max(window.innerHeight || 0, 240);
  const baseLeft = window.scrollX + viewportWidth / 2 - 140;
  const baseTop = window.scrollY + viewportHeight / 2 - 60;
  const style = {
    position: 'absolute',
    left: `${Math.round(Math.max(window.scrollX + 40, baseLeft))}px`,
    top: `${Math.round(Math.max(window.scrollY + 40, baseTop))}px`,
    zIndex: Z_INDEX_FLOATING_DEFAULT,
  };
  if (normalized === 'area') {
    style.minHeight = '180px';
    style.width = '320px';
  }
  const defaultText =
    normalized === 'tooltip'
      ? t('editor.tooltipTextPlaceholder')
      : normalized === 'area'
        ? ''
        : t('editor.textPlaceholder');
  const isSiteWide = scope === 'site';
  return {
    id,
    siteUrl: runtime.siteKey || runtime.pageUrl,
    pageUrl: isSiteWide ? runtime.siteKey || runtime.pageUrl : runtime.pageKey || runtime.pageUrl,
    type: normalized,
    text: defaultText,
    selector: 'body',
    position: 'append',
    style,
    layout: normalized === 'area' ? 'row' : undefined,
    linkTarget: normalized === 'link' ? 'new-tab' : undefined,
    tooltipPosition: normalized === 'tooltip' ? 'top' : undefined,
    tooltipPersistent: normalized === 'tooltip' ? false : undefined,
    frameSelectors: Array.isArray(runtime.frameContext?.frameSelectors)
      ? runtime.frameContext.frameSelectors.slice()
      : [],
    frameLabel: runtime.frameContext?.frameLabel,
    frameUrl: runtime.frameContext?.frameUrl,
    createdAt: now,
    updatedAt: now,
    floating: true,
  };
}

export function resolvePlacementTargetFromRect(rect) {
  if (!rect || typeof rect.left !== 'number' || typeof rect.top !== 'number') {
    return null;
  }
  const clientX = Math.round(rect.left - window.scrollX + rect.width / 2);
  const clientY = Math.round(rect.top - window.scrollY + rect.height / 2);
  let candidate = document.elementFromPoint(clientX, clientY);
  candidate = selectorModule.resolveTarget(candidate);
  return candidate instanceof HTMLElement ? candidate : null;
}

export function applyDraftPlacementToTarget(draft, target) {
  if (!draft || !(target instanceof HTMLElement)) {
    return false;
  }
  let selector = '';
  try {
    selector = selectorModule.generateSelector(target);
  } catch (_error) {
    selector = '';
  }
  if (!selector) {
    return false;
  }
  draft.selector = selector;
  draft.position = 'append';
  draft.floating = false;
  draft.containerId = '';
  const nextStyle = { ...(draft.style || {}) };
  delete nextStyle.position;
  delete nextStyle.left;
  delete nextStyle.top;
  delete nextStyle.zIndex;
  delete nextStyle.width;
  delete nextStyle.height;
  draft.style = nextStyle;
  return true;
}

function beginClickPlacement(requestedType, scope = 'page', options = {}) {
  // Ensure clean state before starting click-based placement
  stopPicker();
  refreshPageContextFromLocation();
  const overlay = selectorModule.createOverlay();
  document.body.appendChild(overlay.container);
  document.body.style.cursor = 'crosshair';
  let disposed = false;
  const useDrawer = options?.mode === 'drawer';

  const cleanup = (notifyCancel) => {
    if (disposed) {
      return;
    }
    disposed = true;
    document.removeEventListener('mousemove', handleMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
    overlay.dispose();
    document.body.style.cursor = '';
    state.pickerSession = null;
    if (notifyCancel) {
      try {
        chrome.runtime.sendMessage({ type: MessageType.PICKER_CANCELLED, pageUrl: runtime.pageUrl });
      } catch (_error) {
        // ignore notification errors
      }
    }
  };

  const handleMove = (event) => {
    const target = selectorModule.resolveTarget(event.target);
    if (target instanceof Element) {
      overlay.show(target);
    } else {
      overlay.hide();
    }
  };

  const handleClick = (event) => {
    const target = selectorModule.resolveTarget(event.target);
    if (!(target instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    cleanup(false);
    const draft = buildDraftElement(
      requestedType === 'tooltip' || requestedType === 'link' || requestedType === 'button' ? requestedType : 'button',
      scope,
    );
    if (requestedType === 'button') {
      // Provide sensible default size for buttons even when attached
      draft.style = {
        ...(draft.style || {}),
        minWidth: draft.style?.minWidth || '120px',
        minHeight: draft.style?.minHeight || '36px',
      };
    }
    // Special-case: if user clicked an Area host, insert into that Area instead
    try {
      const HOST_ATTRIBUTE = 'data-page-augmentor-id';
      const hostEl = target.closest(`[${HOST_ATTRIBUTE}]`);
      const containerId = hostEl instanceof HTMLElement ? hostEl.getAttribute(HOST_ATTRIBUTE) : '';
      const containerMeta = containerId ? injectModule.getElement(containerId) : null;
      if (containerMeta && containerMeta.type === 'area') {
        // Attach into area container: clear absolute styles and mark as non-floating inside container
        const nextStyle = { ...(draft.style || {}) };
        delete nextStyle.position;
        delete nextStyle.left;
        delete nextStyle.top;
        delete nextStyle.zIndex;
        delete nextStyle.width;
        delete nextStyle.height;
        draft.style = nextStyle;
        draft.floating = false;
        draft.containerId = containerId;
        // leave draft.selector as default; insertHost will use containerId branch
      } else {
        // Default: attach to clicked DOM target
        const attachedToDom = applyDraftPlacementToTarget(draft, target);
        if (!attachedToDom) {
          try {
            chrome.runtime.sendMessage({
              type: MessageType.PICKER_CANCELLED,
              pageUrl: runtime.pageUrl,
              data: { error: 'Unable to resolve a selector for the chosen element.' },
            });
          } catch (_error) {}
          return;
        }
      }
    } catch (_e) {}
    highlightPlacementTarget(target);
    const ensured = injectModule.ensureElement(draft);
    if (!ensured) {
      try {
        chrome.runtime.sendMessage({
          type: MessageType.PICKER_CANCELLED,
          pageUrl: runtime.pageUrl,
          data: { error: requestedType === 'tooltip' ? 'Unable to insert the tooltip on this page.' : 'Unable to insert the element on this page.' },
        });
      } catch (_error) {
        // ignore notification failures
      }
      return;
    }
    injectModule.setEditingElement(draft.id, true);
    state.creationElementId = draft.id;
    state.activeEditorElementId = useDrawer ? null : draft.id;
    state.editorSession = null;
    if (useDrawer) {
      const frameMetadata = selectorModule.resolveFrameContext(target.ownerDocument?.defaultView || window);
      sendMessage(MessageType.PICKER_RESULT, {
        pageUrl: runtime.pageUrl,
        siteUrl: runtime.siteKey || runtime.pageUrl,
        selector: draft.selector,
        frameSelectors: frameMetadata.frameSelectors,
        frameLabel: frameMetadata.frameLabel,
        frameUrl: frameMetadata.frameUrl,
        intent: 'create-draft',
        draft,
      }).catch((error) => console.error('[Ladybrid] Failed to notify draft placement', error));
      injectModule.focusElement(draft.id);
      return;
    }
    injectModule.setEditingElement(draft.id, false);
    state.creationElementId = null;
    state.activeEditorElementId = null;
    state.editorSession = null;
    const payload = {
      ...draft,
      id: draft.id,
      siteUrl: runtime.siteKey || runtime.pageUrl,
      pageUrl: draft.pageUrl || runtime.pageKey || runtime.pageUrl,
      selector: draft.selector,
      position: draft.position,
      frameSelectors: Array.isArray(runtime.frameContext?.frameSelectors)
        ? runtime.frameContext.frameSelectors.slice()
        : [],
      frameLabel: runtime.frameContext?.frameLabel,
      frameUrl: runtime.frameContext?.frameUrl,
      createdAt: draft.createdAt,
      updatedAt: Date.now(),
    };
    sendMessage(MessageType.CREATE, payload).catch((error) =>
      console.error('[Ladybrid] Failed to save new element', error),
    );
    injectModule.focusElement(draft.id);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cleanup(true);
    }
  };

  document.addEventListener('mousemove', handleMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  state.pickerSession = { stop: () => cleanup(true) };
}

export function beginTooltipPlacement() {
  beginClickPlacement('tooltip');
}

export function beginCreationSession(options = {}) {
  // Reset any existing interactions before starting a new creation flow
  stopPicker();
  closeEditorBubble();
  cancelCreationDraft();
  const requestedType = typeof options.type === 'string' ? options.type : 'button';
  const scope = options.scope === 'site' ? 'site' : 'page';
  const useDrawer = options.mode === 'drawer';
  if (requestedType !== 'area') {
    beginClickPlacement(requestedType, scope, { mode: options.mode });
    return;
  }
  // Area keeps rectangle draw to define placement and size
  const drawer = selectorModule.startRectDraw({
    onComplete(rect) {
      const draft = buildDraftElement(requestedType, scope);
      draft.style = {
        ...(draft.style || {}),
        position: 'absolute',
        left: `${Math.max(0, rect.left)}px`,
        top: `${Math.max(0, rect.top)}px`,
        width: `${Math.max(24, rect.width)}px`,
        height: `${Math.max(24, rect.height)}px`,
        zIndex: (draft.style?.zIndex && String(draft.style.zIndex).trim()) || Z_INDEX_FLOATING_DEFAULT,
      };
      draft.floating = true;
      const ensured = injectModule.ensureElement(draft);
      if (!ensured) {
        try {
          chrome.runtime.sendMessage({
            type: MessageType.PICKER_CANCELLED,
            pageUrl: runtime.pageUrl,
            data: { error: 'Unable to insert the element on this page.' },
          });
        } catch (_error) {
          // ignore notification failures
        }
        return;
      }
      injectModule.setEditingElement(draft.id, true);
      state.creationElementId = draft.id;
      state.activeEditorElementId = useDrawer ? null : draft.id;
      state.editorSession = null;
      if (useDrawer) {
        const frameMetadata = selectorModule.resolveFrameContext(window);
        sendMessage(MessageType.PICKER_RESULT, {
          pageUrl: runtime.pageUrl,
          siteUrl: runtime.siteKey || runtime.pageUrl,
          selector: draft.selector,
          frameSelectors: frameMetadata.frameSelectors,
          frameLabel: frameMetadata.frameLabel,
          frameUrl: frameMetadata.frameUrl,
          intent: 'create-draft',
          draft,
        }).catch((error) => console.error('[Ladybrid] Failed to notify draft placement', error));
        injectModule.focusElement(draft.id);
        return;
      }
      injectModule.setEditingElement(draft.id, false);
      state.creationElementId = null;
      state.activeEditorElementId = null;
      state.editorSession = null;
      const payload = {
        ...draft,
        id: draft.id,
        siteUrl: runtime.siteKey || runtime.pageUrl,
        pageUrl: draft.pageUrl || runtime.pageKey || runtime.pageUrl,
        selector: draft.selector,
        position: draft.position,
        frameSelectors: Array.isArray(runtime.frameContext?.frameSelectors)
          ? runtime.frameContext.frameSelectors.slice()
          : [],
        frameLabel: runtime.frameContext?.frameLabel,
        frameUrl: runtime.frameContext?.frameUrl,
        createdAt: draft.createdAt,
        updatedAt: Date.now(),
      };
      sendMessage(MessageType.CREATE, payload).catch((error) =>
        console.error('[Ladybrid] Failed to save new element', error),
      );
      injectModule.focusElement(draft.id);
    },
    onCancel() {
      try {
        chrome.runtime.sendMessage({ type: MessageType.PICKER_CANCELLED, pageUrl: runtime.pageUrl });
      } catch (_error) {
        // ignore notification errors
      }
    },
  });
  // store to allow explicit cancellation if needed later
  state.pickerSession = drawer;
}

export function beginDrawerDraft(options = {}) {
  stopPicker();
  closeEditorBubble();
  cancelCreationDraft();
  const requestedType = typeof options.type === 'string' ? options.type : 'button';
  const scope = options.scope === 'site' ? 'site' : 'page';
  const draft = buildDraftElement(requestedType, scope);
  const ensured = injectModule.ensureElement(draft);
  if (!ensured) {
    return null;
  }
  injectModule.setEditingElement(draft.id, true);
  state.creationElementId = draft.id;
  state.activeEditorElementId = null;
  state.editorSession = null;
  return draft;
}

export function cancelDraftElement(draftId) {
  if (state.creationElementId && (!draftId || state.creationElementId === draftId)) {
    cancelCreationDraft();
    return;
  }
  if (!draftId) {
    return;
  }
  try {
    injectModule.setEditingElement(draftId, false);
  } catch (_error) {
    // ignore
  }
  try {
    injectModule.removeElement(draftId);
  } catch (_error) {
    // ignore
  }
}

export function finalizeDraftElement(draftId) {
  if (!draftId) {
    return;
  }
  if (state.creationElementId === draftId) {
    state.creationElementId = null;
  }
  if (state.activeEditorElementId === draftId) {
    state.activeEditorElementId = null;
  }
  try {
    injectModule.setEditingElement(draftId, false);
  } catch (_error) {
    // ignore
  }
}
