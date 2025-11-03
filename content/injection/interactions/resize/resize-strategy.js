import { attachResizeBehavior } from './resize.js';

/**
 * Unified entry to attach resize behavior.
 * Kept as a thin wrapper for parity with drag strategy routing.
 * @param {HTMLElement} node
 * @param {import('../../common/types.js').InjectedElement} element
 * @param {HTMLElement} host
 */
export function attachResizeStrategy(node, element, host) {
  attachResizeBehavior(node, element, host);
}



