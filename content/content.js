/* eslint-disable no-undef */
// コンテンツスクリプトのエントリーポイント。注入要素の同期とピッカー連携を担当する。
import { sendMessage, MessageType } from '../common/messaging.js';
import * as selectorModule from './selector.js';
import * as injectModule from './inject.js';
import { normalizePageUrl } from '../common/url.js';

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
  };

  await hydrateElements();
  setupMessageBridge();
  setupMutationWatcher();

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

  /**
   * バックグラウンドから保存済み要素を取得し、ページへ反映する。
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
   * 渡された要素リストと DOM を同期させる。
   * Synchronizes the injected DOM with the provided list.
   * @param {import('../common/types.js').InjectedElement[]} list
   */
  function synchronizeElements(list) {
    if (!Array.isArray(list)) {
      return;
    }
    const incomingIds = new Set();
    list.forEach((element) => {
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
   * バックグラウンドからのメッセージを受け取るリスナーを設定する。
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
        default:
          break;
      }
      return true;
    });
  }

  /**
   * DOM 変化を監視し、必要に応じて要素を再描画する。
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
   * 要素ピッカーを開始し、選択完了時にバブルフローを起動する。
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
      zIndex: '2147482000',
    };
    if (normalized === 'area') {
      style.minHeight = '180px';
      style.width = '320px';
    }
    return {
      id,
      pageUrl,
      type: normalized,
      text: '',
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

  function beginCreationSession(options = {}) {
    stopPicker();
    closeEditorBubble();
    cancelCreationDraft();
    const requestedType = typeof options.type === 'string' ? options.type : 'button';
    const draft = buildDraftElement(requestedType);
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
  }

  /**
   * アクティブなピッカーを停止する。
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
   * 既存の注入要素に対してページ内エディターを表示する。
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
        injectModule.previewElement(elementId, updated || {});
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
   * エディターバブルがあれば閉じる。
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
   * 選択した要素の概要テキストを生成する。
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
 * ストレージ識別用に正規化した URL を返す。
 * Returns a normalized URL for storage grouping.
 * @returns {string}
 */
function getPageUrl() {
  return normalizePageUrl(window.location.href);
}
