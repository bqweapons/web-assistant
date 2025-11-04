/* eslint-disable no-undef */
  const TARGET_HIGHLIGHT_CLASS = 'page-augmentor-target-highlight';

  function ensureTargetHighlightStyles() {
    if (document.getElementById('page-augmentor-target-highlight-style')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'page-augmentor-target-highlight-style';
    style.textContent = `
      .${TARGET_HIGHLIGHT_CLASS} {
        outline: 2px solid rgba(37, 99, 235, 0.55) !important;
        outline-offset: 2px !important;
        transition: outline-color 0.2s ease;
      }
    `;
    document.head?.appendChild(style);
  }

  function highlightPlacementTarget(element) {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    ensureTargetHighlightStyles();
    element.classList.add(TARGET_HIGHLIGHT_CLASS);
    window.setTimeout(() => {
      try {
        element.classList.remove(TARGET_HIGHLIGHT_CLASS);
      } catch (_error) {
        // Element may have been removed; ignore cleanup failures
      }
    }, 1200);
  }

// 繧ｳ繝ｳ繝・Φ繝・せ繧ｯ繝ｪ繝励ヨ縺ｮ繧ｨ繝ｳ繝医Μ繝ｼ繝昴う繝ｳ繝医よｳｨ蜈･隕∫ｴ縺ｮ蜷梧悄縺ｨ繝斐ャ繧ｫ繝ｼ騾｣謳ｺ繧呈球蠖薙☆繧九・
import { sendMessage, MessageType } from '../common/messaging.js';
import * as selectorModule from '../selector.js';
import * as injectModule from '../inject.js';
import { normalizePageUrl } from '../common/url.js';
import { t } from '../../common/i18n.js';
import { HOST_ATTRIBUTE, Z_INDEX_FLOATING_DEFAULT } from '../injection/core/constants.js';

(async () => {
  if (window.__pageAugmentorInitialized) {
    return;
  }
  window.__pageAugmentorInitialized = true;

  const frameContext = selectorModule.resolveFrameContext(window);
  const pageUrl = frameContext.pageUrl || getPageUrl();

  const state = {
    pickerSession: /** @type {{ stop: () => void } | null} */ (null),
    editorSession: /** @type {{ close: () => void } | null} */ (null),
    activeEditorElementId: /** @type {string | null} */ (null),
    creationElementId: /** @type {string | null} */ (null),
    editingMode: false,
  };

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
        // Fallback: when the composedPath does not surface the host,
        // resolve the shadow host and check it.
        try {
          const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
          if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
            const host = root.host;
            if (host.hasAttribute(HOST_ATTRIBUTE)) {
              return host;
            }
          }
        } catch (_e) {
          // ignore root resolution failures
        }
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
    // If the editor bubble is already open for this element, suppress re-open
    // to avoid resetting its transient state during drag/resize interactions.
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    if (state.activeEditorElementId && state.activeEditorElementId === elementId && state.editorSession) {
      return;
    }
    openEditorBubble(elementId);
  }

  function applyEditingMode(enabled) {
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
      // Close any open editor bubble and clear highlights when exiting edit mode
      try {
        closeEditorBubble();
      } catch (_error) {
        // ignore cleanup failures
      }
    }
  }

  await hydrateElements();
  setupMessageBridge();
  setupMutationWatcher();

  // Persist drag/placement changes even when the editor bubble isn't open
  window.addEventListener('page-augmentor-draft-update', (event) => {
    try {
      const detail = (event && event.detail) || {};
      const elementId = typeof detail.elementId === 'string' ? detail.elementId : null;
      if (!elementId) return;
      // Skip autosave for unsaved creation drafts; the Save action will persist
      if (state.creationElementId && state.creationElementId === elementId) return;
      // When editing bubble is open, skip autosave only when no placement changes were requested
      const hasPlacementMutation =
        Object.prototype.hasOwnProperty.call(detail, 'containerId') ||
        Object.prototype.hasOwnProperty.call(detail, 'floating') ||
        Object.prototype.hasOwnProperty.call(detail, 'selector') ||
        Object.prototype.hasOwnProperty.call(detail, 'position') ||
        (detail.style &&
          (Object.prototype.hasOwnProperty.call(detail.style || {}, 'left') ||
            Object.prototype.hasOwnProperty.call(detail.style || {}, 'top') ||
            Object.prototype.hasOwnProperty.call(detail.style || {}, 'position') ||
            Object.prototype.hasOwnProperty.call(detail.style || {}, 'zIndex'))) ||
        Object.prototype.hasOwnProperty.call(detail, 'text');
      if (state.activeEditorElementId && state.activeEditorElementId === elementId && !hasPlacementMutation) {
        return;
      }
      const base = injectModule.getElement(elementId);
      if (!base) return;

      const merged = { ...base };
      if (detail && typeof detail.style === 'object') {
        merged.style = { ...(base.style || {}), ...detail.style };
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'containerId')) {
        merged.containerId = typeof detail.containerId === 'string' ? detail.containerId : '';
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'floating')) {
        merged.floating = Boolean(detail.floating);
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'selector')) {
        merged.selector = detail.selector;
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'position')) {
        merged.position = detail.position;
      }
      if (Object.prototype.hasOwnProperty.call(detail || {}, 'text')) {
        merged.text = typeof detail.text === 'string' ? detail.text : merged.text;
      }

      const payload = {
        ...merged,
        id: elementId,
        pageUrl,
        updatedAt: Date.now(),
      };
      // Update local registry immediately to avoid visual snap-back before background roundtrip
      try {
        injectModule.updateElement(payload);
      } catch (_e) {}
      sendMessage(MessageType.UPDATE, payload).catch(() => {});
    } catch (_e) {
      // ignore autosave failures in drag handler
    }
  });

  function matchesFrameSelectors(candidate) {
    const selectors = Array.isArray(candidate) ? candidate : [];
    if (!frameContext.sameOriginWithTop) {
      return selectors.length === 0;
    }
    if (selectors.length !== frameContext.frameSelectors.length) {
      return false;
    }
    return selectors.every((value, index) => value === frameContext.frameSelectors[index]);
  }

  function elementMatchesFrame(element) {
    return element ? matchesFrameSelectors(element.frameSelectors) : false;
  }

  function beginTooltipPlacement() {
    stopPicker();
    const overlay = selectorModule.createOverlay();
    document.body.appendChild(overlay.container);
    document.body.style.cursor = 'crosshair';
    let disposed = false;

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
          chrome.runtime.sendMessage({ type: MessageType.PICKER_CANCELLED, pageUrl });
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
      const draft = buildDraftElement('tooltip');
      const attached = applyDraftPlacementToTarget(draft, target);
      if (!attached) {
        try {
          chrome.runtime.sendMessage({
            type: MessageType.PICKER_CANCELLED,
            pageUrl,
            data: { error: 'Unable to resolve a selector for the chosen element.' },
          });
        } catch (_error) {
          // ignore notification failures
        }
        return;
      }
      highlightPlacementTarget(target);
      const ensured = injectModule.ensureElement(draft);
      if (!ensured) {
        try {
          chrome.runtime.sendMessage({
            type: MessageType.PICKER_CANCELLED,
            pageUrl,
            data: { error: 'Unable to insert the tooltip on this page.' },
          });
        } catch (_error) {
          // ignore notification failures
        }
        return;
      }
      injectModule.setEditingElement(draft.id, true);
      state.creationElementId = draft.id;
      state.activeEditorElementId = draft.id;
      const host = injectModule.getHost(draft.id);
      if (!host) {
        cancelCreationDraft();
        return;
      }
      const session = selectorModule.openElementEditor({
        mode: 'create',
        target: host,
        selector: draft.selector,
        values: draft,
        onPreview(updated) {
          injectModule.previewElement(draft.id, updated || {});
        },
        onSubmit(updated) {
          injectModule.previewElement(draft.id, updated || {});
          injectModule.setEditingElement(draft.id, false);
          state.creationElementId = null;
          state.activeEditorElementId = null;
          state.editorSession = null;
          const payload = {
            ...draft,
            ...updated,
            id: draft.id,
            pageUrl,
            selector: draft.selector,
            position: draft.position,
            frameSelectors: Array.isArray(frameContext.frameSelectors)
              ? frameContext.frameSelectors.slice()
              : [],
            frameLabel: frameContext.frameLabel,
            frameUrl: frameContext.frameUrl,
            createdAt: draft.createdAt,
            updatedAt: Date.now(),
          };
          sendMessage(MessageType.CREATE, payload).catch((error) =>
            console.error('[PageAugmentor] Failed to save new element', error),
          );
        },
        onCancel() {
          injectModule.setEditingElement(draft.id, false);
          cancelCreationDraft();
          state.editorSession = null;
          try {
            chrome.runtime.sendMessage({ type: MessageType.PICKER_CANCELLED, pageUrl });
          } catch (_error) {
            // ignore notification errors
          }
        },
      });
      state.editorSession = session;
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

  /**
   * 繝舌ャ繧ｯ繧ｰ繝ｩ繧ｦ繝ｳ繝峨°繧我ｿ晏ｭ俶ｸ医∩隕∫ｴ繧貞叙蠕励＠縲√・繝ｼ繧ｸ縺ｸ蜿肴丐縺吶ｋ縲・
   * Requests stored elements from the background script and renders them.
   * @returns {Promise<void>}
   */
  async function hydrateElements() {
    try {
      const elements = await sendMessage(MessageType.LIST_BY_URL, { pageUrl });
      synchronizeElements(elements);
    } catch (error) {
      console.error('[PageAugmentor] Failed to hydrate elements', error);
    }
  }

  /**
   * 貂｡縺輔ｌ縺溯ｦ∫ｴ繝ｪ繧ｹ繝医→ DOM 繧貞酔譛溘＆縺帙ｋ縲・
   * Synchronizes the injected DOM with the provided list.
   * @param {import('../common/types.js').InjectedElement[]} list
   */
  function synchronizeElements(list) {
    if (!Array.isArray(list)) {
      return;
    }
    const sorted = [...list].sort((a, b) => {
      const rank = (value) => {
        if (!value || typeof value !== 'object') {
          return 2;
        }
        if (value.type === 'area') {
          return 0;
        }
        if (typeof value.containerId === 'string' && value.containerId) {
          return 1;
        }
        return 2;
      };
      const diff = rank(a) - rank(b);
      return diff === 0 ? 0 : diff;
    });
    const incomingIds = new Set();
    sorted.forEach((element) => {
      if (elementMatchesFrame(element)) {
        incomingIds.add(element.id);
        injectModule.ensureElement(element);
      }
    });
    injectModule.listElements().forEach((existing) => {
      if (existing.pageUrl === pageUrl && elementMatchesFrame(existing) && !incomingIds.has(existing.id)) {
        if (state.creationElementId && existing.id === state.creationElementId) {
          return;
        }
        injectModule.removeElement(existing.id);
      }
    });
  }

  /**
   * 繝舌ャ繧ｯ繧ｰ繝ｩ繧ｦ繝ｳ繝峨°繧峨・繝｡繝・そ繝ｼ繧ｸ繧貞女縺大叙繧九Μ繧ｹ繝翫・繧定ｨｭ螳壹☆繧九・
   * Configures messaging listeners for background-originated events.
   */
  function setupMessageBridge() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message?.type) {
        return;
      }
      if (message.pageUrl && message.pageUrl !== pageUrl) {
        return;
      }
      switch (message.type) {
        case MessageType.REHYDRATE: {
          synchronizeElements(message.data || []);
          sendResponse?.({ ok: true });
          break;
        }
        case MessageType.UPDATE: {
          if (message.data && elementMatchesFrame(message.data)) {
            injectModule.updateElement(message.data);
          } else if (message.data?.id) {
            const existing = injectModule.getElement(message.data.id);
            if (existing && elementMatchesFrame(existing)) {
              injectModule.updateElement({ ...existing, ...message.data });
            }
          }
          sendResponse?.({ ok: true });
          break;
        }
        case MessageType.DELETE: {
          if (message.data?.id) {
            if (elementMatchesFrame(message.data)) {
              injectModule.removeElement(message.data.id);
            } else {
              const existing = injectModule.getElement(message.data.id);
              if (existing && elementMatchesFrame(existing)) {
                injectModule.removeElement(message.data.id);
              }
            }
          }
          sendResponse?.({ ok: true });
          break;
        }
        case MessageType.FOCUS_ELEMENT: {
          if (message.data?.id && matchesFrameSelectors(message.data.frameSelectors)) {
            const success = injectModule.focusElement(message.data.id);
            sendResponse?.({ ok: success });
          }
          break;
        }
        case MessageType.START_PICKER: {
          beginPicker(message.data || {});
          sendResponse?.({ ok: true });
          break;
        }
        case MessageType.INIT_CREATE: {
          beginCreationSession(message.data || {});
          sendResponse?.({ ok: true });
          break;
        }
        case MessageType.CANCEL_PICKER: {
          stopPicker();
          sendResponse?.({ ok: true });
          break;
        }
        case MessageType.OPEN_EDITOR: {
          if (message.data?.id && matchesFrameSelectors(message.data.frameSelectors)) {
            const opened = openEditorBubble(message.data.id);
            sendResponse?.({ ok: opened });
          }
          break;
        }
        case MessageType.SET_EDIT_MODE: {
          applyEditingMode(Boolean(message.data?.enabled));
          sendResponse?.({ ok: true });
          break;
        }
        default:
          break;
      }
      return true;
    });
  }

  /**
   * DOM 螟牙喧繧堤屮隕悶＠縲∝ｿ・ｦ√↓蠢懊§縺ｦ隕∫ｴ繧貞・謠冗判縺吶ｋ縲・
   * Observes DOM mutations and re-applies injected elements when necessary.
   */
  function setupMutationWatcher() {
    let timeoutId = 0;
    const observer = new MutationObserver(() => {
      if (timeoutId) {
        return;
      }
      timeoutId = window.setTimeout(() => {
        timeoutId = 0;
        injectModule.reconcileElements();
      }, 300);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * 隕∫ｴ繝斐ャ繧ｫ繝ｼ繧帝幕蟋九＠縲・∈謚槫ｮ御ｺ・凾縺ｫ繝舌ヶ繝ｫ繝輔Ο繝ｼ繧定ｵｷ蜍輔☆繧九・
   * Starts the element picker and opens the bubble workflow on selection.
   * @param {{ mode?: 'create' }} [options]
   */
  function beginPicker(options = {}) {
    stopPicker();
    closeEditorBubble();
    document.body.style.cursor = 'crosshair';
    state.pickerSession = selectorModule.startElementPicker({
      mode: options.mode || 'create',
      onTarget(target, selector) {
        const metadata = selectorModule.resolveFrameContext(target.ownerDocument?.defaultView || window);
        sendMessage(MessageType.PICKER_RESULT, {
          pageUrl,
          selector,
          frameSelectors: metadata.frameSelectors,
          frameLabel: metadata.frameLabel,
          frameUrl: metadata.frameUrl,
          preview: describeElement(target),
        }).catch((error) => console.error('[PageAugmentor] Failed to send picker result', error));
      },
      onSubmit(payload) {
        stopPicker();
        const elementPayload = {
          ...payload,
          pageUrl,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        sendMessage(MessageType.CREATE, elementPayload).catch((error) =>
          console.error('[PageAugmentor] Failed to save new element', error),
        );
      },
      onCancel() {
        stopPicker();
        sendMessage(MessageType.PICKER_CANCELLED, { pageUrl }).catch((error) =>
          console.error('[PageAugmentor] Failed to report picker cancel', error),
        );
      },
    });
  }

  function cancelCreationDraft() {
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

  function buildDraftElement(type) {
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
          ? t('editor.areaTextPlaceholder')
          : t('editor.textPlaceholder');
    return {
      id,
      pageUrl,
      type: normalized,
      text: defaultText,
      selector: 'body',
      position: 'append',
      style,
      tooltipPosition: normalized === 'tooltip' ? 'top' : undefined,
      tooltipPersistent: normalized === 'tooltip' ? false : undefined,
      frameSelectors: Array.isArray(frameContext.frameSelectors)
        ? frameContext.frameSelectors.slice()
        : [],
      frameLabel: frameContext.frameLabel,
      frameUrl: frameContext.frameUrl,
      createdAt: now,
      updatedAt: now,
      floating: true,
    };
  }

  function resolvePlacementTargetFromRect(rect) {
    if (!rect || typeof rect.left !== 'number' || typeof rect.top !== 'number') {
      return null;
    }
    const clientX = Math.round(rect.left - window.scrollX + rect.width / 2);
    const clientY = Math.round(rect.top - window.scrollY + rect.height / 2);
    let candidate = document.elementFromPoint(clientX, clientY);
    candidate = selectorModule.resolveTarget(candidate);
    return candidate instanceof HTMLElement ? candidate : null;
  }

  function applyDraftPlacementToTarget(draft, target) {
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

  function beginCreationSession(options = {}) {
    stopPicker();
    closeEditorBubble();
    cancelCreationDraft();
    const requestedType = typeof options.type === 'string' ? options.type : 'button';
    if (requestedType === 'tooltip') {
      beginTooltipPlacement();
      return;
    }
    // Let the user drag a rectangle to define placement and size
    const drawer = selectorModule.startRectDraw({
      onComplete(rect) {
        const draft = buildDraftElement(requestedType);
        let placementTarget = null;
        let attachedToTarget = false;
        if (requestedType !== 'area') {
          placementTarget = resolvePlacementTargetFromRect(rect);
          attachedToTarget = applyDraftPlacementToTarget(draft, placementTarget);
          if (attachedToTarget && placementTarget) {
            highlightPlacementTarget(placementTarget);
          }
        }
        if (!attachedToTarget || requestedType === 'area') {
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
        }
        const ensured = injectModule.ensureElement(draft);
        if (!ensured) {
          try {
            chrome.runtime.sendMessage({
              type: MessageType.PICKER_CANCELLED,
              pageUrl,
              data: { error: 'Unable to insert the element on this page.' },
            });
          } catch (_error) {
            // ignore notification failures
          }
          return;
        }
        injectModule.setEditingElement(draft.id, true);
        state.creationElementId = draft.id;
        state.activeEditorElementId = draft.id;
        const host = injectModule.getHost(draft.id);
        if (!host) {
          cancelCreationDraft();
          return;
        }
        const session = selectorModule.openElementEditor({
          mode: 'create',
          target: host,
          selector: draft.selector,
          values: draft,
          onPreview(updated) {
            injectModule.previewElement(draft.id, updated || {});
          },
          onSubmit(updated) {
            injectModule.previewElement(draft.id, updated || {});
            injectModule.setEditingElement(draft.id, false);
            state.creationElementId = null;
            state.activeEditorElementId = null;
            state.editorSession = null;
            const payload = {
              ...draft,
              ...updated,
              id: draft.id,
              pageUrl,
              selector: draft.selector,
              position: draft.position,
              frameSelectors: Array.isArray(frameContext.frameSelectors)
                ? frameContext.frameSelectors.slice()
                : [],
              frameLabel: frameContext.frameLabel,
              frameUrl: frameContext.frameUrl,
              createdAt: draft.createdAt,
              updatedAt: Date.now(),
            };
            sendMessage(MessageType.CREATE, payload).catch((error) =>
              console.error('[PageAugmentor] Failed to save new element', error),
            );
          },
          onCancel() {
            injectModule.setEditingElement(draft.id, false);
            cancelCreationDraft();
            state.editorSession = null;
            try {
              chrome.runtime.sendMessage({ type: MessageType.PICKER_CANCELLED, pageUrl });
            } catch (_error) {
              // ignore notification errors
            }
          },
        });
        state.editorSession = session;
        injectModule.focusElement(draft.id);
      },
      onCancel() {
        try {
          chrome.runtime.sendMessage({ type: MessageType.PICKER_CANCELLED, pageUrl });
        } catch (_error) {
          // ignore notification errors
        }
      },
    });
    // store to allow explicit cancellation if needed later
    state.pickerSession = drawer;
  }

  /**
   * 繧｢繧ｯ繝・ぅ繝悶↑繝斐ャ繧ｫ繝ｼ繧貞●豁｢縺吶ｋ縲・
   * Stops the active picker session.
   */
  function stopPicker() {
    if (state.pickerSession) {
      try {
        state.pickerSession.stop();
      } catch (error) {
        console.warn('[PageAugmentor] Failed to stop picker cleanly', error);
      }
      state.pickerSession = null;
    }
    document.body.style.cursor = '';
  }

  /**
   * 譌｢蟄倥・豕ｨ蜈･隕∫ｴ縺ｫ蟇ｾ縺励※繝壹・繧ｸ蜀・お繝・ぅ繧ｿ繝ｼ繧定｡ｨ遉ｺ縺吶ｋ縲・
   * Opens the in-page editor bubble for an existing injected element.
   * @param {string} elementId
   * @returns {boolean}
   */
  function openEditorBubble(elementId) {
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
          const autosavePayload = {
            ...element,
            ...(updated || {}),
            id: elementId,
            pageUrl,
            updatedAt: Date.now(),
          };
          sendMessage(MessageType.UPDATE, autosavePayload).catch(() => {});
        } catch (_error) {
          // ignore autosave failures
        }
      },
      onSubmit(updated) {
        injectModule.previewElement(elementId, updated || {});
        state.activeEditorElementId = null;
        injectModule.setEditingElement(elementId, false);
        closeEditorBubble();
        const payload = {
          ...element,
          ...updated,
          pageUrl,
          id: elementId,
          updatedAt: Date.now(),
        };
        sendMessage(MessageType.UPDATE, payload).catch((error) =>
          console.error('[PageAugmentor] Failed to update element', error),
        );
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

  /**
   * 繧ｨ繝・ぅ繧ｿ繝ｼ繝舌ヶ繝ｫ縺後≠繧後・髢峨§繧九・
   * Closes the editor bubble if present.
   */
  function closeEditorBubble() {
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

  /**
   * 驕ｸ謚槭＠縺溯ｦ∫ｴ縺ｮ讎りｦ√ユ繧ｭ繧ｹ繝医ｒ逕滓・縺吶ｋ縲・
   * Produces a human-friendly description of the selected element.
   * @param {Element} element
   * @returns {{ tag: string; text: string; classes: string }}
   */
  function describeElement(element) {
    const text = (element.textContent || '').trim().slice(0, 80);
    const classes = (element.className || '')
      .toString()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join('.');
    return {
      tag: element.tagName.toLowerCase(),
      text,
      classes,
    };
  }
})();

/**
 * 繧ｹ繝医Ξ繝ｼ繧ｸ隴伜挨逕ｨ縺ｫ豁｣隕丞喧縺励◆ URL 繧定ｿ斐☆縲・
 * Returns a normalized URL for storage grouping.
 * @returns {string}
 */
function getPageUrl() {
  return normalizePageUrl(window.location.href);
}


