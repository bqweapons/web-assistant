import { HOST_ATTRIBUTE, Z_INDEX_FLOATING_DEFAULT, Z_INDEX_HOST_DEFAULT } from '../../core/index.js';

export const AREA_DRAG_THRESHOLD = 4;

/**
 * ホストが編集モードで操作可能かを判定する。
 * Determines whether drag interactions are permitted for the host.
 * @param {HTMLElement | null} host
 * @returns {boolean}
 */
export function isEditingAllowed(host) {
  return (
    host?.dataset?.pageAugmentorEditing === 'true' ||
    host?.dataset?.pageAugmentorGlobalEditing === 'true'
  );
}

/**
 * Pointer Capture を安全に設定し、失敗時は握り潰す。
 * Safely sets pointer capture ignoring unsupported errors.
 * @param {Element & { setPointerCapture?: (pointerId: number) => void }} el
 * @param {number | undefined | null} pointerId
 */
export function setPointerCaptureSafe(el, pointerId) {
  if (pointerId == null) return;
  try {
    el.setPointerCapture(pointerId);
  } catch (_e) {}
}

/**
 * Pointer Capture を安全に解除する。
 * Safely releases pointer capture when supported.
 * @param {Element & { releasePointerCapture?: (pointerId: number) => void }} el
 * @param {number | undefined | null} pointerId
 */
export function releasePointerCaptureSafe(el, pointerId) {
  if (pointerId == null) return;
  try {
    el.releasePointerCapture(pointerId);
  } catch (_e) {}
}

/**
 * 任意ノードから所属するホスト要素を解決する。
 * Resolves the host element that owns a given node.
 * @param {Node | null} node
 * @returns {HTMLElement | null}
 */
export function getHostFromNode(node) {
  const root = node?.getRootNode?.();
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    return root.host;
  }
  return null;
}

/**
 * ホストの境界をビューポートではなくページ座標で返す。
 * Returns the host bounding box in page coordinates.
 * @param {HTMLElement} host
 * @returns {{ left: number; top: number; width: number; height: number }}
 */
export function getHostRectScreen(host) {
  const rect = host.getBoundingClientRect();
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * ホストの left/top スタイルを整数ピクセルで更新する。
 * Sets the host's left and top styles rounded to integers.
 * @param {HTMLElement} host
 * @param {number} left
 * @param {number} top
 */
export function setHostPosition(host, left, top) {
  host.style.left = `${Math.round(left)}px`;
  host.style.top = `${Math.round(top)}px`;
}

/**
 * フローティング要素用に絶対配置スタイルを組み立てる。
 * Builds an absolute-positioned style object for floating elements.
 * @param {Record<string, string>} previousStyle
 * @param {number} left
 * @param {number} top
 * @returns {Record<string, string>}
 */
export function buildAbsoluteStyle(previousStyle, left, top) {
  const base = previousStyle || {};
  const zIndex = base.zIndex && String(base.zIndex).trim() ? String(base.zIndex).trim() : Z_INDEX_FLOATING_DEFAULT;
  return {
    ...base,
    position: 'absolute',
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    zIndex,
  };
}

/**
 * ホストからドラフト更新イベントをバブルさせる。
 * Dispatches a draft update event from the host.
 * @param {HTMLElement | null} host
 * @param {Record<string, any>} detail
 */
export function dispatchDraftUpdateFromHost(host, detail) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const elementId = host.getAttribute(HOST_ATTRIBUTE);
  const payload = {
    ...(detail || {}),
  };
  if (!payload.elementId && elementId) {
    payload.elementId = elementId;
  }
  host.dispatchEvent(
    new CustomEvent('page-augmentor-draft-update', {
      detail: payload,
      bubbles: true,
      composed: true,
    }),
  );
}

/**
 * Dispatches a UI-only update event from the host (not persisted).
 * Used for transient hints like bubbleSide during interactions.
 * @param {HTMLElement | null} host
 * @param {Record<string, any>} detail
 */
export function dispatchUiUpdateFromHost(host, detail) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const elementId = host.getAttribute(HOST_ATTRIBUTE);
  const payload = { ...(detail || {}) };
  if (!payload.elementId && elementId) {
    payload.elementId = elementId;
  }
  host.dispatchEvent(
    new CustomEvent('page-augmentor-ui-update', {
      detail: payload,
      bubbles: true,
      composed: true,
    }),
  );
}

/**
 * フローティングホストの配置座標を決定する。
 * Positions a floating host relative to an element or target.
 * @param {HTMLElement | null} host
 * @param {import('../../../../common/types.js').InjectedElement} element
 * @param {Element | null} target
 */
export function positionFloatingHost(host, element, target) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const style = element?.style || {};
  const hasAbsolute = typeof style.position === 'string' && style.position.trim().toLowerCase() === 'absolute';
  const left = typeof style.left === 'string' ? style.left.trim() : '';
  const top = typeof style.top === 'string' ? style.top.trim() : '';

  host.style.position = 'absolute';
  host.style.zIndex = typeof style.zIndex === 'string' && style.zIndex.trim() ? style.zIndex : Z_INDEX_HOST_DEFAULT;
  host.style.width = '';
  host.style.height = '';

  if (hasAbsolute && left && top) {
    host.style.left = left;
    host.style.top = top;
    return;
  }

  const reference = target instanceof Element ? target.getBoundingClientRect() : null;
  if (reference) {
    host.style.left = `${reference.left + window.scrollX + 16}px`;
    host.style.top = `${reference.top + window.scrollY + 16}px`;
  } else {
    host.style.left = `${window.scrollX + 120}px`;
    host.style.top = `${window.scrollY + 120}px`;
  }
}



