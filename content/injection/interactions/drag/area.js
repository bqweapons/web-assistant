import {
  AREA_DRAG_THRESHOLD,
  isEditingAllowed,
  getHostFromNode,
  getHostRectScreen,
  setHostPosition,
  setPointerCaptureSafe,
  releasePointerCaptureSafe,
  buildAbsoluteStyle,
  dispatchDraftUpdateFromHost,
  dispatchUiUpdateFromHost,
} from './core.js';
import { NODE_CLASS } from '../../core/constants.js';

/**
 * エリア要素に対してドラッグでの位置変更と浮動化を提供する。
 * Attaches drag behaviour that converts an area into a floating element.
 * @param {HTMLElement | null} node
 * @param {import('../../../../common/types.js').InjectedElement} element
 */
export function attachAreaDragBehavior(node, element) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  if (node.dataset.areaDragBound === 'true') {
    node.dataset.areaElementId = element.id;
    return;
  }
  node.dataset.areaDragBound = 'true';
  node.dataset.areaElementId = element.id;
  node.style.touchAction = 'none';

  let dragging = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let movedSincePointerDown = false;
  let lastBubbleSide = 'right';

  // ドラッグ中のポインタ移動に応じてホスト位置を更新する。
  const handleMove = (event) => {
    if (!dragging || pointerId !== event.pointerId) {
      return;
    }
    const host = getHostFromNode(node);
    if (!host) {
      return;
    }
    if (!movedSincePointerDown) {
      const deltaX = Math.abs(event.clientX - startX);
      const deltaY = Math.abs(event.clientY - startY);
      if (deltaX > AREA_DRAG_THRESHOLD || deltaY > AREA_DRAG_THRESHOLD) {
        movedSincePointerDown = true;
        try {
          const desired = event.clientX > window.innerWidth / 2 ? 'left' : 'right';
          if (desired !== lastBubbleSide) {
            const h = getHostFromNode(node);
            if (h) dispatchUiUpdateFromHost(h, { bubbleSide: desired });
            lastBubbleSide = desired;
          }
        } catch (_e) { }
      }
    }
  const nextLeft = originLeft + (event.clientX - startX);
  const nextTop = originTop + (event.clientY - startY);
  setHostPosition(host, nextLeft, nextTop);
};

  // ドラッグ終了後に浮動モードへ切り替え、ドラフト更新を送信する。
  const finalizeDrag = async () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    node.classList.remove('page-augmentor-area-dragging');
    node.style.userSelect = '';
    const host = getHostFromNode(node);
    if (!host) {
      return;
    }
    const rect = getHostRectScreen(host);
    const nextLeft = Math.round(rect.left);
    const nextTop = Math.round(rect.top);
    const previousStyle = element.style || {};
    const nextStyle = buildAbsoluteStyle(previousStyle, nextLeft, nextTop);
    element.style = nextStyle;
    element.floating = true;
    delete element.containerId;
    host.style.position = 'absolute';
    setHostPosition(host, nextLeft, nextTop);
    host.style.zIndex = nextStyle.zIndex || '';
    dispatchDraftUpdateFromHost(host, {
      elementId: element.id,
      style: {
        position: nextStyle.position,
        left: nextStyle.left,
        top: nextStyle.top,
        zIndex: nextStyle.zIndex,
      },
      floating: true,
      containerId: '',
    });
    dispatchUiUpdateFromHost(host, { bubbleSide: 'right' });
  };

  node.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== -1) {
      return;
    }
    // If the pointerdown originated from a child injected node inside this area,
    // let the child's own drag handler take over and do not start area dragging.
    try {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const interactedChildNode = Array.isArray(path)
        ? path.find(
            (n) => n instanceof HTMLElement && n !== node && n.classList && n.classList.contains(NODE_CLASS),
          )
        : null;
      if (interactedChildNode) {
        return;
      }
    } catch (_err) {
      // Ignore composedPath issues; fall back to default behaviour.
    }
    const host = getHostFromNode(node);
    if (!host || !isEditingAllowed(host)) {
      return;
    }
    dispatchUiUpdateFromHost(host, { bubbleSide: 'left' });
    dragging = true;
    pointerId = event.pointerId;
    movedSincePointerDown = false;
    startX = event.clientX;
    startY = event.clientY;
    const rect = getHostRectScreen(host);
    originLeft = rect.left;
    originTop = rect.top;
    node.classList.add('page-augmentor-area-dragging');
    node.style.userSelect = 'none';
    setPointerCaptureSafe(node, pointerId);
    event.preventDefault();
    event.stopPropagation();
  });

  node.addEventListener('pointermove', handleMove);
  node.addEventListener('pointerup', (event) => {
    if (event.pointerId === pointerId) {
      releasePointerCaptureSafe(node, pointerId);
      pointerId = null;
      finalizeDrag();
    }
  });
  node.addEventListener('pointercancel', () => {
    pointerId = null;
    finalizeDrag();
  });

  // Suppress click that follows a drag to avoid re-triggering the editor click handler
  node.addEventListener(
    'click',
    (event) => {
      if (movedSincePointerDown) {
        event.stopPropagation();
        event.preventDefault();
        movedSincePointerDown = false;
      }
    },
    true,
  );
}




