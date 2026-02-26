import * as injectModule from '../inject.js';
import { HOST_ATTRIBUTE } from '../injection/core/constants.js';

export function setupMutationWatcher() {
  let timeoutId = 0;
  const HOST_SELECTOR = `[${HOST_ATTRIBUTE}]`;
  const UI_ROOT_SELECTOR = '[data-page-augmentor-root]';

  /**
   * @param {Node} node
   * @returns {node is Element}
   */
  function isElement(node) {
    return !!node && node.nodeType === Node.ELEMENT_NODE;
  }

  /**
   * Determines whether an element is part of the Ladybird UI tree
   * (bubble, overlays, etc.) and should be ignored by the watcher.
   * @param {Element} el
   */
  function isInsideAugmentorUi(el) {
    try {
      return Boolean(el.closest(UI_ROOT_SELECTOR));
    } catch (_e) {
      return false;
    }
  }

  /**
   * Checks whether the element itself or any of its descendants is a host.
   * Ignores elements under the augmentor UI root.
   * @param {Element} el
   */
  function elementContainsHost(el) {
    if (!(el instanceof Element)) return false;
    if (isInsideAugmentorUi(el)) return false;
    try {
      if (el.matches(HOST_SELECTOR)) return true;
    } catch (_e) {
      // ignore selector errors
    }
    try {
      return Boolean(el.querySelector(HOST_SELECTOR));
    } catch (_e) {
      // ignore selector errors
      return false;
    }
  }

  /**
   * Determines whether a mutation involving the given element is relevant
   * for host reconciliation. Any DOM changes outside the augmentor UI are
   * treated as relevant so that SPA-style view updates can restore hosts
   * even when the original host subtree was removed earlier.
   * @param {Element} el
   * @returns {boolean}
   */
  function isRelevantMutationElement(el) {
    if (!(el instanceof Element)) {
      return false;
    }
    if (isInsideAugmentorUi(el)) {
      return false;
    }
    // Always treat non-UI DOM additions/removals as relevant to support SPA
    // routers that replace view containers without our hosts present yet.
    return true;
  }

  const observer = new MutationObserver((records) => {
    // Evaluate relevance before scheduling a reconcile
    let relevant = false;
    for (const record of records) {
      if (record.type !== 'childList') continue;
      // Added nodes
      for (const node of record.addedNodes || []) {
        if (isElement(node) && (elementContainsHost(node) || isRelevantMutationElement(node))) {
          relevant = true;
          break;
        }
      }
      if (relevant) break;
      // Removed nodes (disconnected subtree)
      for (const node of record.removedNodes || []) {
        if (isElement(node) && (elementContainsHost(node) || isRelevantMutationElement(node))) {
          relevant = true;
          break;
        }
      }
      if (relevant) break;
    }
    if (!relevant) {
      return;
    }
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
