import { Z_INDEX_FLOATING_DEFAULT } from '../../core/index.js';
import { getStyleTarget } from '../../ui/index.js';
import {
  setPointerCaptureSafe,
  releasePointerCaptureSafe,
  dispatchDraftUpdateFromHost,
  dispatchUiUpdateFromHost,
} from '../drag/core.js';

export function attachResizeBehavior(node, element, host) {
  if (!(node instanceof HTMLElement) || !(host instanceof HTMLElement)) {
    return;
  }
  if (node.dataset.resizeBound === 'true') {
    return;
  }
  node.dataset.resizeBound = 'true';

  const ensureResizeHandles = () => {
    if (node.querySelector('.page-augmentor-resize-handle')) {
      return;
    }
    const positions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    positions.forEach((pos) => {
      const handle = document.createElement('div');
      handle.className = `page-augmentor-resize-handle ${pos}`;
      handle.dataset.handle = pos;
      handle.addEventListener('pointerdown', (event) => startResize(event, pos));
      node.appendChild(handle);
    });
  };

  let resizing = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let originWidth = 0;
  let originHeight = 0;
  const MIN_SIZE = 24;

  const startResize = (event, edge) => {
    if (!(event instanceof PointerEvent)) return;
    if (event.button !== 0 && event.button !== -1) return;
    if (host.dataset.pageAugmentorEditing !== 'true') return;
    resizing = true;
    pointerId = event.pointerId;
    const rect = host.getBoundingClientRect();
    originLeft = rect.left + window.scrollX;
    originTop = rect.top + window.scrollY;
    originWidth = rect.width;
    originHeight = rect.height;
    startX = event.clientX;
    startY = event.clientY;
    setPointerCaptureSafe(node, pointerId);
    dispatchUiUpdateFromHost(host, { bubbleSide: 'left' });
    window.addEventListener('pointermove', handleResizeMove, true);
    window.addEventListener('pointerup', handleResizeUp, true);
    event.preventDefault();
    event.stopPropagation();
  };

  const handleResizeMove = (event) => {
    if (!resizing || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    let nextLeft = originLeft;
    let nextTop = originTop;
    let nextWidth = originWidth;
    let nextHeight = originHeight;

    const edge = getActiveHandle();
    if (edge.includes('e')) {
      nextWidth = Math.max(MIN_SIZE, originWidth + dx);
    }
    if (edge.includes('s')) {
      nextHeight = Math.max(MIN_SIZE, originHeight + dy);
    }
    if (edge.includes('w')) {
      nextWidth = Math.max(MIN_SIZE, originWidth - dx);
      nextLeft = originLeft + dx;
    }
    if (edge.includes('n')) {
      nextHeight = Math.max(MIN_SIZE, originHeight - dy);
      nextTop = originTop + dy;
    }

    // Apply live visuals
    const styleTarget = getStyleTarget(node);
    if (styleTarget instanceof HTMLElement) {
      styleTarget.style.width = `${Math.round(nextWidth)}px`;
      styleTarget.style.height = `${Math.round(nextHeight)}px`;
    }
    if (element.floating !== false) {
      host.style.left = `${Math.round(nextLeft)}px`;
      host.style.top = `${Math.round(nextTop)}px`;
      host.style.position = 'absolute';
      host.style.zIndex = (element.style?.zIndex && String(element.style.zIndex).trim()) || Z_INDEX_FLOATING_DEFAULT;
    }
    event.preventDefault();
  };

  const handleResizeUp = (event) => {
    if (!resizing || event.pointerId !== pointerId) return;
    releasePointerCaptureSafe(node, pointerId);
    window.removeEventListener('pointermove', handleResizeMove, true);
    window.removeEventListener('pointerup', handleResizeUp, true);
    resizing = false;
    pointerId = null;

    const rect = host.getBoundingClientRect();
    const finalLeft = Math.round(rect.left + window.scrollX);
    const finalTop = Math.round(rect.top + window.scrollY);
    const finalWidth = Math.max(MIN_SIZE, Math.round(rect.width));
    const finalHeight = Math.max(MIN_SIZE, Math.round(rect.height));
    const nextStyle = { ...(element.style || {}) };
    nextStyle.width = `${finalWidth}px`;
    nextStyle.height = `${finalHeight}px`;
    if (element.floating !== false) {
      nextStyle.position = 'absolute';
      nextStyle.left = `${finalLeft}px`;
      nextStyle.top = `${finalTop}px`;
      if (!nextStyle.zIndex || !String(nextStyle.zIndex).trim()) {
        nextStyle.zIndex = Z_INDEX_FLOATING_DEFAULT;
      }
    }
    // Do not mutate element; persist via draft update only
    dispatchDraftUpdateFromHost(host, {
      elementId: element.id,
      style: {
        position: nextStyle.position,
        left: nextStyle.left,
        top: nextStyle.top,
        width: nextStyle.width,
        height: nextStyle.height,
        zIndex: nextStyle.zIndex || '',
      },
      floating: element.floating !== false,
      containerId: element.containerId || '',
    });
    dispatchUiUpdateFromHost(host, { bubbleSide: 'right' });
  };

  const getActiveHandle = () => {
    const active = node.querySelector('.page-augmentor-resize-handle:hover');
    if (active instanceof HTMLElement) {
      return active.dataset.handle || '';
    }
    // Fallback: default to se if none hovered (shouldn’t happen during drag)
    return 'se';
  };

  ensureResizeHandles();
}






