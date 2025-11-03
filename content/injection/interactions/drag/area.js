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
} from './core.js';

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
      }
    }
    const nextLeft = originLeft + (event.clientX - startX);
    const nextTop = originTop + (event.clientY - startY);
    setHostPosition(host, nextLeft, nextTop);
  };

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
      bubbleSide: 'right',
    });
  };

  node.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== -1) {
      return;
    }
    const host = getHostFromNode(node);
    if (!host || !isEditingAllowed(host)) {
      return;
    }
    dispatchDraftUpdateFromHost(host, { bubbleSide: 'left' });
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



