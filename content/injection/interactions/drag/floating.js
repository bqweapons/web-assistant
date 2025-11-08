import { Z_INDEX_FLOATING_DEFAULT } from '../../core/constants.js';
import {
  isEditingAllowed,
  getHostFromNode,
  getHostRectScreen,
  setHostPosition,
  setPointerCaptureSafe,
  releasePointerCaptureSafe,
  dispatchDraftUpdateFromHost,
  dispatchUiUpdateFromHost,
} from '../drag/core.js';

/**
 * フローティング要素にドラッグ移動とドロップ先判定を付与する。
 * Attaches floating drag interactions and drop handling to a node.
 * @param {HTMLElement | null} node
 * @param {import('../../../../common/types.js').InjectedElement} element
 * @param {import('../drag/strategy.js').DragDeps} deps
 */
export function attachFloatingDragBehavior(node, element, deps) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  if (!element || !element.id) {
    return;
  }
  if (node.dataset.floatingDragBound === 'true') {
    node.dataset.floatingElementId = element.id;
    return;
  }
  node.dataset.floatingDragBound = 'true';
  node.dataset.floatingElementId = element.id;
  node.style.touchAction = 'none';

  const DRAG_ACTIVATION_THRESHOLD = 4;
  let dragging = false;
  let dragStarted = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let originalContainerId = typeof element.containerId === 'string' ? element.containerId : '';
  let originalFloating = element.floating !== false;
  let originalStyle = { ...(element.style || {}) };
  let originalParent = null;
  let originalNextSibling = null;
  let currentDropTarget = null; // { kind: 'area'|'dom', area|placement }
  let highlightedArea = null;
  let startRect = null;
  let suppressNextClick = false;
  let lastBubbleSide = 'right';

  // ドロップ候補のエリアを強調表示し、前回のハイライトを解除する。
  const updateHighlight = (areaTarget) => {
    if (highlightedArea && highlightedArea !== areaTarget) {
      highlightedArea.areaNode.classList.remove('page-augmentor-area-drop-target');
      highlightedArea = null;
    }
    if (areaTarget && areaTarget.areaNode && highlightedArea !== areaTarget) {
      areaTarget.areaNode.classList.add('page-augmentor-area-drop-target');
      highlightedArea = areaTarget;
    }
  };

  // 最初のドラッグ移動時にホストを絶対配置へ切り替える。
  const startDragging = () => {
    if (dragStarted) {
      return;
    }
    const host = getHostFromNode(node);
    if (!host) {
      return;
    }
    dragStarted = true;
    suppressNextClick = true;
    if (startRect) {
      host.style.width = `${startRect.width}px`;
      host.style.height = `${startRect.height}px`;
    }
    // Hint bubble side on drag start based on initial position
    try {
      const hostCenterX = Math.round(originLeft + (startRect ? startRect.width / 2 : 0));
      const desired = hostCenterX > window.scrollX + window.innerWidth / 2 ? 'left' : 'right';
      if (desired !== lastBubbleSide) {
        dispatchUiUpdateFromHost(host, { bubbleSide: desired });
        lastBubbleSide = desired;
      }
    } catch (_e) {}
    host.style.position = 'absolute';
    host.style.left = `${Math.round(originLeft)}px`;
    host.style.top = `${Math.round(originTop)}px`;
    host.style.zIndex = originalStyle.zIndex && originalStyle.zIndex.trim() ? originalStyle.zIndex : Z_INDEX_FLOATING_DEFAULT;
    if (host.parentElement !== document.body) {
      document.body.appendChild(host);
    }
    node.classList.add('page-augmentor-floating-dragging');
    node.style.userSelect = 'none';
    currentDropTarget = null;
    highlightedArea = null;
    deps.hideDomDropIndicator();
    deps.removeDropPreviewHost();
    if (pointerId !== null) {
      setPointerCaptureSafe(node, pointerId);
    }
  };

  // ドラッグ終了時に位置を確定または元に戻す。
  const finalizeDrag = (commit) => {
    const host = getHostFromNode(node);
    if (!host) {
      return;
    }
    if (pointerId !== null) {
      releasePointerCaptureSafe(node, pointerId);
    }
    pointerId = null;
    dragging = false;
    dragStarted = false;
    // keep suppressNextClick true until click is bubbled after drag when commit succeeded
    startRect = null;
    node.classList.remove('page-augmentor-floating-dragging');
    node.style.userSelect = '';
    updateHighlight(null);
    deps.hideDomDropIndicator();
    deps.removeDropPreviewHost();
    host.style.width = '';
    host.style.height = '';

    if (!commit) {
      if (originalParent instanceof Node) {
        if (originalNextSibling instanceof Node) {
          originalParent.insertBefore(host, originalNextSibling);
        } else {
          originalParent.appendChild(host);
        }
      }
      // Do not mutate the element object on cancel; only revert host visuals
      if (originalFloating) {
        host.style.position = 'absolute';
        host.style.left = originalStyle.left || '';
        host.style.top = originalStyle.top || '';
        host.style.zIndex = originalStyle.zIndex || '';
      } else {
        deps.resetHostPosition(host);
      }
      dispatchDraftUpdateFromHost(host, {});
      dispatchUiUpdateFromHost(host, { bubbleSide: 'right' });
      dispatchUiUpdateFromHost(host, { bubbleSide: 'right' });
      return;
    }

    const dropTarget = currentDropTarget;
    currentDropTarget = null;
    if (dropTarget && dropTarget.kind === 'area' && dropTarget.area?.content) {
      dropTarget.area.content.appendChild(host);
      deps.resetHostPosition(host);
      // Build next style for payload without mutating element
      const nextStyle = { ...(element.style || {}) };
      nextStyle.position = '';
      nextStyle.left = '';
      nextStyle.top = '';
      deps.clearPendingContainerAttachment(element.id);
      // Persist container attachment + floating state via draft update
      dispatchDraftUpdateFromHost(host, {
        elementId: element.id,
        containerId: dropTarget.area.id,
        floating: false,
        // Explicitly clear absolute positioning when moved into an area
        style: {
          position: nextStyle.position || '',
          left: nextStyle.left || '',
          top: nextStyle.top || '',
          zIndex: nextStyle.zIndex || '',
          width: '',
          height: '',
        },
      });
      dispatchUiUpdateFromHost(host, { bubbleSide: 'right' });
      return;
    }

    if (dropTarget && dropTarget.kind === 'dom' && dropTarget.placement) {
      let reference = dropTarget.placement.reference;
      const selector = dropTarget.placement.selector;
      const position = dropTarget.placement.position;
      if (!(reference instanceof HTMLElement) || !reference.isConnected) {
        const fallback = typeof selector === 'string' ? deps.resolveSelector(selector) : null;
        if (fallback instanceof HTMLElement) {
          reference = fallback;
        }
      }
      if (reference instanceof HTMLElement && selector) {
        if (position === 'append') {
          reference.appendChild(host);
        } else if (position === 'prepend') {
          reference.insertBefore(host, reference.firstChild);
        } else if (position === 'before' && reference.parentElement) {
          reference.parentElement.insertBefore(host, reference);
        } else if (position === 'after' && reference.parentElement) {
          reference.parentElement.insertBefore(host, reference.nextSibling);
        } else {
          document.body.appendChild(host);
        }
        deps.resetHostPosition(host);
        // Do not mutate element; build next style for payload
        const nextStyle = { ...(element.style || {}) };
        nextStyle.position = '';
        nextStyle.left = '';
        nextStyle.top = '';
        nextStyle.zIndex = '';
        deps.clearPendingContainerAttachment(element.id);
        // Persist selector/position change via draft update so autosave triggers
        dispatchDraftUpdateFromHost(host, {
          elementId: element.id,
          selector,
          position,
          containerId: '',
          floating: false,
          style: {
            position: nextStyle.position,
            left: nextStyle.left,
            top: nextStyle.top,
            zIndex: nextStyle.zIndex,
          },
        });
        dispatchUiUpdateFromHost(host, { bubbleSide: 'right' });
        return;
      }
    }

    document.body.appendChild(host);
    const rect = getHostRectScreen(host);
    const left = Math.round(rect.left);
    const top = Math.round(rect.top);
    host.style.position = 'absolute';
    setHostPosition(host, left, top);
    const nextStyle = { ...(element.style || {}) };
    nextStyle.position = 'absolute';
    nextStyle.left = `${left}px`;
    nextStyle.top = `${top}px`;
    nextStyle.zIndex = nextStyle.zIndex && nextStyle.zIndex.trim() ? nextStyle.zIndex : Z_INDEX_FLOATING_DEFAULT;
    // Do not mutate element; persist via draft update below
    deps.clearPendingContainerAttachment(element.id);
    // Persist floating position so preview/state stay in sync
    dispatchDraftUpdateFromHost(host, {
      elementId: element.id,
      floating: true,
      containerId: '',
      style: {
        position: nextStyle.position,
        left: nextStyle.left,
        top: nextStyle.top,
        zIndex: nextStyle.zIndex,
      },
    });
    dispatchUiUpdateFromHost(host, { bubbleSide: 'right' });
  };

  const handleMove = (event) => {
    if (!dragging || event.pointerId !== pointerId) {
      return;
    }
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    const host = getHostFromNode(node);
    if (!host) {
      return;
    }
    if (!dragStarted) {
      const deltaX = Math.abs(event.clientX - startX);
      const deltaY = Math.abs(event.clientY - startY);
      if (deltaX <= DRAG_ACTIVATION_THRESHOLD && deltaY <= DRAG_ACTIVATION_THRESHOLD) {
        return;
      }
      startDragging();
    }
    // While dragging, keep bubble on the opposite side of pointer X
    try {
      const desired = event.clientX > window.innerWidth / 2 ? 'left' : 'right';
      if (desired !== lastBubbleSide) {
        dispatchUiUpdateFromHost(host, { bubbleSide: desired });
        lastBubbleSide = desired;
      }
    } catch (_e) {}
    const nextLeft = originLeft + (event.clientX - startX);
    const nextTop = originTop + (event.clientY - startY);
    setHostPosition(host, nextLeft, nextTop);
    const areaDropTarget = deps.findAreaDropTarget(event.clientX, event.clientY, element.id);
    if (areaDropTarget) {
      currentDropTarget = { kind: 'area', area: areaDropTarget };
      updateHighlight(areaDropTarget);
      deps.showAreaDropPreview(areaDropTarget, element);
      deps.hideDomDropIndicator();
      return;
    }
    updateHighlight(null);
    deps.removeDropPreviewHost();
    const domTarget = deps.findDomDropTarget(event.clientX, event.clientY, host);
    if (domTarget instanceof HTMLElement) {
      const placement = deps.resolveDomDropPlacement(domTarget, event.clientX, event.clientY);
      if (placement) {
        currentDropTarget = { kind: 'dom', placement };
        deps.showDomDropPreview(placement, element);
        deps.showDomDropIndicator(placement.indicator);
        return;
      }
    }
    currentDropTarget = null;
    deps.hideDomDropIndicator();
    deps.removeDropPreviewHost();
  };

  node.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== -1) {
      return;
    }
    const host = getHostFromNode(node);
    if (!host || !isEditingAllowed(host)) {
      return;
    }
    // Do not change bubble side on mere click; wait for actual drag.
    dragging = true;
    dragStarted = false;
    suppressNextClick = false;
    pointerId = event.pointerId;
    // Defer pointer capture until an actual drag starts to avoid
    // interfering with click handling in editing mode. Pointer capture
    // will be set inside startDragging() after threshold is exceeded.
    startX = event.clientX;
    startY = event.clientY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    const rect = getHostRectScreen(host);
    originLeft = rect.left;
    originTop = rect.top;
    originalContainerId = typeof element.containerId === 'string' ? element.containerId : '';
    originalFloating = element.floating !== false;
    originalStyle = { ...(element.style || {}) };
    originalParent = host.parentNode;
    originalNextSibling = host.nextSibling;
    currentDropTarget = null;
    highlightedArea = null;
    startRect = rect;
    deps.hideDomDropIndicator();
    deps.removeDropPreviewHost();
    const isGlobalEditing = host.dataset.pageAugmentorGlobalEditing === 'true';
    if (!isGlobalEditing) {
      startDragging();
      event.preventDefault();
    }
  });

  node.addEventListener('pointermove', handleMove);
  node.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointerId) {
      return;
    }
    const host = getHostFromNode(node);
    const isGlobalEditing = host?.dataset?.pageAugmentorGlobalEditing === 'true';
    // In editing mode, a simple click should open the editor bubble.
    // Avoid running finalize logic (which can interfere with click dispatch)
    // when no actual drag started.
    if (isGlobalEditing && !dragStarted) {
      pointerId = null;
      dragging = false;
      return;
    }
    finalizeDrag(dragStarted);
  });
  node.addEventListener('pointercancel', () => {
    finalizeDrag(false);
  });

  node.addEventListener(
    'click',
    (event) => {
      const host = getHostFromNode(node);
      const isGlobalEditing = host?.dataset?.pageAugmentorGlobalEditing === 'true';
      if (isGlobalEditing) {
        // In editing mode, do not suppress clicks so the editor bubble
        // can open via the document-level capture listener.
        suppressNextClick = false;
        return;
      }
      if (suppressNextClick) {
        event.stopPropagation();
        event.preventDefault();
        suppressNextClick = false;
      }
    },
    true,
  );
}





