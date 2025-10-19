/* eslint-disable no-undef */
(async () => {
  if (window.__pageAugmentorInitialized) {
    return;
  }
  window.__pageAugmentorInitialized = true;

  const pageUrl = getPageUrl();
  const [{ sendMessage, MessageType }, selectorModule, injectModule] = await Promise.all([
    import(chrome.runtime.getURL('common/messaging.js')),
    import(chrome.runtime.getURL('content/selector.js')),
    import(chrome.runtime.getURL('content/inject.js')),
  ]);

  const state = {
    pickerSession: /** @type {{ stop: () => void } | null} */ (null),
  };

  await hydrateElements();
  setupMessageBridge();
  setupMutationWatcher();

  /**
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
   * Synchronizes the injected DOM with the provided list.
   * @param {import('../common/types.js').InjectedElement[]} list
   */
  function synchronizeElements(list) {
    if (!Array.isArray(list)) {
      return;
    }
    const incomingIds = new Set();
    list.forEach((element) => {
      incomingIds.add(element.id);
      injectModule.ensureElement(element);
    });
    injectModule.listElements().forEach((existing) => {
      if (existing.pageUrl === pageUrl && !incomingIds.has(existing.id)) {
        injectModule.removeElement(existing.id);
      }
    });
  }

  /**
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
          if (message.data) {
            injectModule.updateElement(message.data);
          }
          sendResponse?.({ ok: true });
          break;
        }
        case MessageType.DELETE: {
          if (message.data?.id) {
            injectModule.removeElement(message.data.id);
          }
          sendResponse?.({ ok: true });
          break;
        }
        case MessageType.FOCUS_ELEMENT: {
          if (message.data?.id) {
            const success = injectModule.focusElement(message.data.id);
            sendResponse?.({ ok: success });
          }
          break;
        }
        case MessageType.START_PICKER: {
          beginPicker();
          sendResponse?.({ ok: true });
          break;
        }
        case MessageType.CANCEL_PICKER: {
          stopPicker();
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
   * Starts the element picker and reports the selection to the extension.
   */
  function beginPicker() {
    stopPicker();
    document.body.style.cursor = 'crosshair';
    state.pickerSession = selectorModule.startElementPicker({
      onPick(target, selector) {
        stopPicker();
        sendMessage(MessageType.PICKER_RESULT, {
          pageUrl,
          selector,
          preview: describeElement(target),
        }).catch((error) => console.error('[PageAugmentor] Failed to send picker result', error));
      },
      onCancel() {
        stopPicker();
        sendMessage(MessageType.PICKER_CANCELLED, { pageUrl }).catch((error) =>
          console.error('[PageAugmentor] Failed to report picker cancel', error),
        );
      },
    });
  }

  /**
   * Stops the active picker session.
   */
  function stopPicker() {
    if (state.pickerSession) {
      state.pickerSession.stop();
      state.pickerSession = null;
    }
    document.body.style.cursor = '';
  }

  /**
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
 * Returns a normalized URL for storage grouping.
 * @returns {string}
 */
function getPageUrl() {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}`;
}
