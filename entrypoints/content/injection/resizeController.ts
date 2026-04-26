import type { StructuredElementRecord } from '../../../shared/siteDataSchema';
import { mergeStyleRules } from './style';
import {
  isElementFloating,
  type RuntimeElement,
} from './shared';
import { getEditingElementId, getEntryRuntime, registry } from './registry';
import {
  FLOATING_Z_INDEX,
  MIN_SIZE,
  type RegistryEntry,
} from './types';
import type { BuildWithRulesFn } from './dropTargets';

export type ResizeCallbacks = {
  injectElement: (element: StructuredElementRecord) => { ok: boolean; error?: string };
  setEditingElement: (id?: string) => void;
  persistElementMutation: (element: StructuredElementRecord) => { ok: boolean; error?: string };
  buildStructuredElementWithStyleRules: BuildWithRulesFn;
};

export const attachResizeHandles = (entry: RegistryEntry, callbacks: ResizeCallbacks) => {
  const host = entry.node;
  const root = entry.root;
  const content = entry.content || host;
  const cleanupFns: Array<() => void> = [];
  const entryId = getEntryRuntime(entry).id;

  const isEditing = () => getEditingElementId() === entryId;

  const startResize = (handle: 'e' | 's' | 'se', event: PointerEvent) => {
    if (!isEditing()) {
      return;
    }
    if (event.button !== 0 && event.button !== -1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const liveEntry = registry.get(entryId);
    if (!liveEntry) {
      return;
    }
    const liveRuntime: RuntimeElement = getEntryRuntime(liveEntry);

    const liveContent = liveEntry.content || liveEntry.node;
    const sizeTarget = liveContent;
    const initialRect = sizeTarget.getBoundingClientRect();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const baseWidth = initialRect.width;
    const baseHeight = initialRect.height;

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) {
        return;
      }
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let nextWidth = baseWidth;
      let nextHeight = baseHeight;
      if (handle.includes('e')) {
        nextWidth = Math.max(MIN_SIZE, baseWidth + dx);
      }
      if (handle.includes('s')) {
        nextHeight = Math.max(MIN_SIZE, baseHeight + dy);
      }
      sizeTarget.style.width = `${Math.round(nextWidth)}px`;
      sizeTarget.style.height = `${Math.round(nextHeight)}px`;
    };

    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', pointerUp, true);
      window.removeEventListener('pointercancel', pointerCancel, true);
      try {
        (event.currentTarget as HTMLElement | null)?.releasePointerCapture(pointerId);
      } catch {
        // ignore
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
      const finalHost = finalEntry.node;
      const finalContent = finalEntry.content || finalHost;
      const finalTarget = finalContent;
      const finalRect = finalTarget.getBoundingClientRect();
      const styleRules = mergeStyleRules(finalRuntime);
      styleRules.width = `${Math.max(MIN_SIZE, Math.round(finalRect.width))}px`;
      styleRules.height = `${Math.max(MIN_SIZE, Math.round(finalRect.height))}px`;

      if (isElementFloating(finalRuntime)) {
        const hostRect = finalHost.getBoundingClientRect();
        styleRules.position = 'absolute';
        styleRules.left = `${Math.round(hostRect.left + window.scrollX)}px`;
        styleRules.top = `${Math.round(hostRect.top + window.scrollY)}px`;
        if (!styleRules.zIndex) {
          styleRules.zIndex = FLOATING_Z_INDEX;
        }
      }

      const nextElement = callbacks.buildStructuredElementWithStyleRules(
        finalEntry.element,
        finalRuntime,
        styleRules,
        {},
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
      (event.currentTarget as HTMLElement | null)?.setPointerCapture(pointerId);
    } catch {
      // ignore
    }

    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', pointerUp, true);
    window.addEventListener('pointercancel', pointerCancel, true);
  };

  if (root) {
    const currentPosition = content.style.position;
    if (!currentPosition || currentPosition === 'static') {
      content.style.position = 'relative';
    }
    (['e', 's', 'se'] as const).forEach((handle) => {
      const handleNode = document.createElement('div');
      handleNode.className = 'ladybird-resize-handle';
      handleNode.dataset.ladybirdResizeHandle = handle;
      const listener = (event: PointerEvent) => startResize(handle, event);
      handleNode.addEventListener('pointerdown', listener);
      content.appendChild(handleNode);
      cleanupFns.push(() => {
        handleNode.removeEventListener('pointerdown', listener);
        handleNode.remove();
      });
    });
  }

  return () => {
    cleanupFns.forEach((cleanup) => cleanup());
  };
};
