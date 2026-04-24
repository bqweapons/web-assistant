import type { StructuredElementRecord } from '../../../shared/siteDataSchema';
import { mergeStyleRules } from './style';
import {
  getElementSelector,
  getElementType,
  type RuntimeElement,
} from './shared';
import { getEditingElementId, getEntryRuntime, registry } from './registry';
import {
  DRAG_Z_INDEX,
  FLOATING_Z_INDEX,
  type DomDropPlacement,
  type RegistryEntry,
} from './types';
import {
  buildAreaOrderUpdates,
  findAreaDropTarget,
  findDomDropTarget,
  hideDropIndicator,
  removeDropPreviewHost,
  resolveDomDropPlacement,
  setAreaHighlight,
  showAreaDropPreview,
  showDomDropPreview,
  showDropIndicator,
  type BuildWithRulesFn,
} from './dropTargets';

export type DragCallbacks = {
  injectElement: (element: StructuredElementRecord) => { ok: boolean; error?: string };
  setEditingElement: (id?: string) => void;
  persistElementMutation: (element: StructuredElementRecord) => { ok: boolean; error?: string };
  buildStructuredElementWithStyleRules: BuildWithRulesFn;
};

export const startDragFor = (
  entryId: string,
  event: PointerEvent,
  callbacks: DragCallbacks,
) => {
  if (getEditingElementId() !== entryId) {
    return;
  }
  if (event.button !== 0 && event.button !== -1) {
    return;
  }

  const liveEntry = registry.get(entryId);
  if (!liveEntry) {
    return;
  }
  const liveRuntime: RuntimeElement = getEntryRuntime(liveEntry);

  const dragHost = liveEntry.node;
  const pointerId = event.pointerId;
  const startRect = dragHost.getBoundingClientRect();
  const startLeft = startRect.left + window.scrollX;
  const startTop = startRect.top + window.scrollY;
  const startX = event.clientX;
  const startY = event.clientY;
  let lastLeft = startLeft;
  let lastTop = startTop;
  let lastPointerX = event.clientX;
  let lastPointerY = event.clientY;
  let activated = false;

  let currentArea: RegistryEntry | null = null;
  let currentPlacement: DomDropPlacement | null = null;

  const activate = () => {
    activated = true;
    dragHost.style.width = `${Math.round(startRect.width)}px`;
    dragHost.style.height = `${Math.round(startRect.height)}px`;
    dragHost.style.position = 'absolute';
    dragHost.style.left = `${Math.round(startLeft)}px`;
    dragHost.style.top = `${Math.round(startTop)}px`;
    dragHost.style.zIndex = DRAG_Z_INDEX;
    if (dragHost.parentElement !== document.body) {
      document.body.appendChild(dragHost);
    }
    dragHost.classList.add('ladybird-dragging');
    document.documentElement.style.userSelect = 'none';
  };

  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }
    lastPointerX = moveEvent.clientX;
    lastPointerY = moveEvent.clientY;
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;
    if (!activated) {
      if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) {
        return;
      }
      activate();
    }
    moveEvent.preventDefault();
    lastLeft = startLeft + deltaX;
    lastTop = startTop + deltaY;
    dragHost.style.left = `${Math.round(lastLeft)}px`;
    dragHost.style.top = `${Math.round(lastTop)}px`;

    if (getElementType(liveRuntime) === 'area') {
      setAreaHighlight(null);
      currentArea = null;
      currentPlacement = null;
      hideDropIndicator();
      removeDropPreviewHost();
      return;
    }

    const areaTarget = findAreaDropTarget(moveEvent.clientX, moveEvent.clientY, liveRuntime.id);
    if (areaTarget) {
      currentArea = areaTarget;
      currentPlacement = null;
      setAreaHighlight(getEntryRuntime(areaTarget).id);
      hideDropIndicator();
      showAreaDropPreview(areaTarget, liveRuntime);
      return;
    }

    setAreaHighlight(null);
    currentArea = null;
    const domTarget = findDomDropTarget(moveEvent.clientX, moveEvent.clientY, dragHost);
    const placement = resolveDomDropPlacement(domTarget, moveEvent.clientX, moveEvent.clientY);
    if (placement) {
      currentPlacement = placement;
      showDropIndicator(placement.indicator);
      showDomDropPreview(placement, liveRuntime);
    } else {
      currentPlacement = null;
      hideDropIndicator();
      removeDropPreviewHost();
    }
  };

  const finish = (commit: boolean) => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', pointerUp, true);
    window.removeEventListener('pointercancel', pointerCancel, true);
    dragHost.classList.remove('ladybird-dragging');
    document.documentElement.style.userSelect = '';
    hideDropIndicator();
    removeDropPreviewHost();
    setAreaHighlight(null);
    try {
      dragHost.releasePointerCapture(pointerId);
    } catch {
      // ignore
    }

    if (!activated) {
      return;
    }
    if (!commit) {
      callbacks.injectElement(liveEntry.element);
      if (getEditingElementId() === liveRuntime.id) {
        callbacks.setEditingElement(liveRuntime.id);
      }
      return;
    }

    const finalEntry = registry.get(entryId);
    if (!finalEntry) {
      return;
    }
    const finalRuntime = getEntryRuntime(finalEntry);
    const styleRules = mergeStyleRules(finalRuntime);

    if (getElementType(finalRuntime) === 'area') {
      styleRules.position = 'absolute';
      styleRules.left = `${Math.round(lastLeft)}px`;
      styleRules.top = `${Math.round(lastTop)}px`;
      if (!styleRules.zIndex) {
        styleRules.zIndex = FLOATING_Z_INDEX;
      }
      const nextElement = callbacks.buildStructuredElementWithStyleRules(
        finalEntry.element,
        finalRuntime,
        styleRules,
        {
          mode: 'floating',
          containerId: undefined,
          selector: getElementSelector(finalRuntime) || 'body',
          position: 'append',
          beforeSelector: undefined,
          afterSelector: undefined,
        },
      );
      callbacks.persistElementMutation(nextElement);
      return;
    }

    if (currentArea) {
      delete styleRules.position;
      delete styleRules.left;
      delete styleRules.top;
      delete styleRules.zIndex;
      const currentAreaRuntime = getEntryRuntime(currentArea);
      const nextElement = callbacks.buildStructuredElementWithStyleRules(
        finalEntry.element,
        finalRuntime,
        styleRules,
        {
          mode: 'container',
          containerId: currentAreaRuntime.id,
          selector: getElementSelector(currentAreaRuntime) || getElementSelector(finalRuntime) || 'body',
          position: 'append',
          beforeSelector: undefined,
          afterSelector: undefined,
        },
      );
      const updates = buildAreaOrderUpdates(
        currentArea,
        nextElement,
        lastPointerX,
        lastPointerY,
        callbacks.buildStructuredElementWithStyleRules,
      );
      updates.forEach((item) => {
        callbacks.persistElementMutation(item);
      });
      return;
    }

    if (currentPlacement) {
      delete styleRules.position;
      delete styleRules.left;
      delete styleRules.top;
      delete styleRules.zIndex;
      delete styleRules.order;
      const nextElement = callbacks.buildStructuredElementWithStyleRules(
        finalEntry.element,
        finalRuntime,
        styleRules,
        {
          mode: 'dom',
          containerId: undefined,
          selector: currentPlacement.selector,
          position: currentPlacement.position,
          beforeSelector: currentPlacement.beforeSelector,
          afterSelector: currentPlacement.afterSelector,
        },
      );
      callbacks.persistElementMutation(nextElement);
      return;
    }

    styleRules.position = 'absolute';
    styleRules.left = `${Math.round(lastLeft)}px`;
    styleRules.top = `${Math.round(lastTop)}px`;
    delete styleRules.order;
    if (!styleRules.zIndex) {
      styleRules.zIndex = FLOATING_Z_INDEX;
    }
    const nextElement = callbacks.buildStructuredElementWithStyleRules(
      finalEntry.element,
      finalRuntime,
      styleRules,
      {
        mode: 'floating',
        containerId: undefined,
        position: 'append',
        beforeSelector: undefined,
        afterSelector: undefined,
      },
    );
    callbacks.persistElementMutation(nextElement);
  };

  const pointerUp = (upEvent: PointerEvent) => {
    if (upEvent.pointerId !== pointerId) {
      return;
    }
    finish(true);
  };

  const pointerCancel = (cancelEvent: PointerEvent) => {
    if (cancelEvent.pointerId !== pointerId) {
      return;
    }
    finish(false);
  };

  try {
    dragHost.setPointerCapture(pointerId);
  } catch {
    // ignore
  }

  event.preventDefault();
  event.stopPropagation();
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', pointerUp, true);
  window.addEventListener('pointercancel', pointerCancel, true);
};
