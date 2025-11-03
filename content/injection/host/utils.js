import { NODE_CLASS } from '../core/constants.js';

/**
 * エリア型ホストのコンテンツ要素を返す。
 * Resolves the content container inside an area host.
 * @param {HTMLElement | null} host
 * @returns {HTMLElement | null}
 */
export function resolveAreaContent(host) {
  if (!(host instanceof HTMLElement)) {
    return null;
  }
  const shadow = host.shadowRoot;
  if (!shadow) {
    return null;
  }
  const areaNode = shadow.querySelector(`.${NODE_CLASS}[data-node-type='area']`);
  if (!(areaNode instanceof HTMLElement)) {
    return null;
  }
  const content = areaNode.querySelector('.page-augmentor-area-content');
  if (content instanceof HTMLElement) {
    return content;
  }
  return areaNode;
}

/**
 * フローティングホストに適用された位置スタイルをリセットする。
 * Resets positioning styles applied to a floating host.
 * @param {HTMLElement | null} host
 */
export function resetHostPosition(host) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  host.style.position = '';
  host.style.left = '';
  host.style.top = '';
  host.style.right = '';
  host.style.bottom = '';
  host.style.zIndex = '';
  host.style.width = '';
  host.style.height = '';
}




