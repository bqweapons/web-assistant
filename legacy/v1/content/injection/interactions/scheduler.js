/**
 * Global helpers to coordinate pointermove throttling and drop policies.
 */

/**
 * Registers a throttled pointermove handler on a node.
 * @param {HTMLElement} node
 * @param {(event: PointerEvent) => void} handler
 * @returns {() => void}
 */
export function registerThrottledPointerMove(node, handler) {
  if (!(node instanceof HTMLElement) || typeof handler !== 'function') {
    return () => {};
  }
  const state = {
    queued: false,
    lastEvent: /** @type {PointerEvent | null} */ (null),
  };
  const listener = (event) => {
    state.lastEvent = event;
    if (state.queued) {
      return;
    }
    state.queued = true;
    window.requestAnimationFrame(() => {
      state.queued = false;
      if (state.lastEvent) {
        handler(state.lastEvent);
      }
    });
  };
  node.addEventListener('pointermove', listener);
  return () => {
    try {
      node.removeEventListener('pointermove', listener);
    } catch (_e) {}
  };
}

const windowMoveStates = new Set();
let windowMoveListenerAttached = false;

function handleWindowPointerMove(event) {
  windowMoveStates.forEach((state) => {
    state.lastEvent = event;
    if (state.queued) {
      return;
    }
    state.queued = true;
    window.requestAnimationFrame(() => {
      state.queued = false;
      if (state.lastEvent) {
        state.handler(state.lastEvent);
      }
    });
  });
}

/**
 * Registers a throttled global pointermove handler on window (capture phase).
 * @param {(event: PointerEvent) => void} handler
 * @returns {() => void}
 */
export function registerThrottledWindowPointerMove(handler) {
  if (typeof handler !== 'function') {
    return () => {};
  }
  const state = {
    handler,
    queued: false,
    lastEvent: /** @type {PointerEvent | null} */ (null),
  };
  windowMoveStates.add(state);
  if (!windowMoveListenerAttached) {
    window.addEventListener('pointermove', handleWindowPointerMove, true);
    windowMoveListenerAttached = true;
  }
  return () => {
    windowMoveStates.delete(state);
    if (windowMoveStates.size === 0 && windowMoveListenerAttached) {
      try {
        window.removeEventListener('pointermove', handleWindowPointerMove, true);
      } catch (_e) {}
      windowMoveListenerAttached = false;
    }
  };
}

const MAX_DROP_AREA = 2_000_000;

/**
 * Returns false when a DOM element should not be used as a drop target
 * because it is excessively large.
 * @param {Element | null} target
 * @returns {boolean}
 */
export function shouldAllowDomDrop(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  try {
    const rect = target.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (!Number.isFinite(area) || area <= 0) {
      return true;
    }
    return area <= MAX_DROP_AREA;
  } catch (_e) {
    return true;
  }
}

