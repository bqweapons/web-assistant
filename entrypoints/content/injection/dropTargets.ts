import type { StructuredElementRecord } from '../../../shared/siteDataSchema';
import { generateSelector, selectorForSibling } from './selector';
import { mergeStyleRules } from './style';
import {
  getElementContainerId,
  getElementLayout,
  getElementType,
  isElementFloating,
  toRuntimeElementPayload,
  type RuntimeElement,
} from './shared';
import {
  getEntryRuntime,
  getHighlightedAreaId,
  registry,
  setHighlightedAreaId,
} from './registry';
import { createElementNode, stripPositioningFromStyle } from './hostFactory';
import {
  EDITING_ATTR,
  HOST_ATTR,
  type DomDropPlacement,
  type DropIndicator,
  type ElementMutationPatch,
  type RegistryEntry,
} from './types';
import type { StructuredElementRecord as StructuredElementRecordAlias } from '../../../shared/siteDataSchema';

export type BuildWithRulesFn = (
  baseElement: StructuredElementRecordAlias,
  baseRuntime: RuntimeElement,
  rules: Record<string, string>,
  patch: ElementMutationPatch,
) => StructuredElementRecordAlias;

let dropIndicatorNode: HTMLElement | null = null;
let dropPreviewHost: HTMLElement | null = null;
let dropPreviewSourceId: string | null = null;

export const setAreaHighlight = (nextId: string | null) => {
  const current = getHighlightedAreaId();
  if (current && current !== nextId) {
    const previous = registry.get(current);
    previous?.content?.classList.remove('ladybird-area-drop-target');
  }
  setHighlightedAreaId(nextId);
  if (nextId) {
    const next = registry.get(nextId);
    next?.content?.classList.add('ladybird-area-drop-target');
  }
};

export const ensureDropIndicator = () => {
  if (dropIndicatorNode && dropIndicatorNode.isConnected) {
    return dropIndicatorNode;
  }
  const indicator = document.createElement('div');
  indicator.dataset.ladybirdDropIndicator = 'true';
  indicator.style.position = 'fixed';
  indicator.style.pointerEvents = 'none';
  indicator.style.background = '#1b84ff';
  indicator.style.borderRadius = '9999px';
  indicator.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.9)';
  indicator.style.zIndex = '2147483645';
  indicator.style.opacity = '0';
  document.body.appendChild(indicator);
  dropIndicatorNode = indicator;
  return indicator;
};

export const showDropIndicator = (indicator: DropIndicator) => {
  void indicator;
};

export const hideDropIndicator = () => {
  if (dropIndicatorNode?.isConnected) {
    dropIndicatorNode.remove();
  }
  dropIndicatorNode = null;
};

export const getDropIndicatorNode = () => dropIndicatorNode;

export const removeDropPreviewHost = () => {
  if (dropPreviewHost?.isConnected) {
    dropPreviewHost.remove();
  }
  dropPreviewHost = null;
  dropPreviewSourceId = null;
};

const ensureDropPreviewHost = (element: RuntimeElement) => {
  if (dropPreviewHost && dropPreviewSourceId === element.id && dropPreviewHost.isConnected) {
    return dropPreviewHost;
  }
  removeDropPreviewHost();
  const previewElement: RuntimeElement = {
    ...element,
    placement: {
      ...element.placement,
      mode: 'dom',
      containerId: undefined,
    },
    style: stripPositioningFromStyle(element.style),
  };
  const { host } = createElementNode({
    ...previewElement,
  });
  host.dataset.ladybirdDropPreview = 'true';
  host.setAttribute(EDITING_ATTR, 'false');
  host.style.pointerEvents = 'none';
  host.style.opacity = '0.5';
  host.style.filter = 'saturate(0.9)';
  host.style.zIndex = '2147483300';
  dropPreviewHost = host;
  dropPreviewSourceId = element.id;
  return host;
};

export const showAreaDropPreview = (dropTarget: RegistryEntry, element: RuntimeElement) => {
  if (!(dropTarget.content instanceof HTMLElement)) {
    return;
  }
  const preview = ensureDropPreviewHost(element);
  if (preview.parentElement !== dropTarget.content) {
    dropTarget.content.appendChild(preview);
  }
};

export const showDomDropPreview = (placement: DomDropPlacement, element: RuntimeElement) => {
  const preview = ensureDropPreviewHost(element);
  const reference = placement.reference;
  if (!(reference instanceof HTMLElement)) {
    removeDropPreviewHost();
    return;
  }
  if (placement.position === 'append') {
    if (preview.parentElement !== reference || reference.lastChild !== preview) {
      reference.appendChild(preview);
    }
    return;
  }
  if (!reference.parentElement) {
    removeDropPreviewHost();
    return;
  }
  if (placement.position === 'before') {
    reference.parentElement.insertBefore(preview, reference);
    return;
  }
  reference.parentElement.insertBefore(preview, reference.nextSibling);
};

export const findAreaDropTarget = (clientX: number, clientY: number, excludeId: string) => {
  for (const [id, entry] of registry) {
    if (id === excludeId || getElementType(getEntryRuntime(entry)) !== 'area') {
      continue;
    }
    const rect = entry.node.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return entry;
    }
  }
  return null;
};

export const findDomDropTarget = (clientX: number, clientY: number, draggedHost: HTMLElement) => {
  const previousPointerEvents = draggedHost.style.pointerEvents;
  draggedHost.style.pointerEvents = 'none';
  try {
    const candidates = document.elementsFromPoint(clientX, clientY);
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) {
        continue;
      }
      if (candidate.closest(`[${HOST_ATTR}]`)) {
        continue;
      }
      if (candidate.closest('[data-ladybird-drop-indicator]')) {
        continue;
      }
      if (candidate.closest('[data-ladybird-drop-preview]')) {
        continue;
      }
      return candidate;
    }
    return null;
  } finally {
    draggedHost.style.pointerEvents = previousPointerEvents;
  }
};

export const resolveDomDropPlacement = (
  target: HTMLElement | null,
  clientX: number,
  clientY: number,
): DomDropPlacement | null => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  if (target === document.documentElement || target === document.body) {
    const rect = document.body.getBoundingClientRect();
    return {
      reference: document.body,
      selector: 'body',
      position: 'append',
      indicator: {
        left: rect.left,
        top: rect.bottom - 2,
        width: Math.max(24, rect.width),
        height: 3,
      },
    };
  }

  let selector = '';
  try {
    selector = generateSelector(target);
  } catch {
    selector = '';
  }
  if (!selector) {
    return null;
  }

  const rect = target.getBoundingClientRect();
  const edges: Array<{ edge: 'top' | 'bottom' | 'left' | 'right'; distance: number }> = [
    { edge: 'top', distance: Math.abs(clientY - rect.top) },
    { edge: 'bottom', distance: Math.abs(clientY - rect.bottom) },
    { edge: 'left', distance: Math.abs(clientX - rect.left) },
    { edge: 'right', distance: Math.abs(clientX - rect.right) },
  ];
  const nearestEdge = edges.sort((a, b) => a.distance - b.distance)[0]?.edge;
  const placeBefore = nearestEdge === 'top' || nearestEdge === 'left';
  const showVerticalLine = nearestEdge === 'left' || nearestEdge === 'right';
  return {
    reference: target,
    selector,
    position: placeBefore ? 'before' : 'after',
    beforeSelector: placeBefore ? selector : selectorForSibling(target.nextElementSibling),
    afterSelector: placeBefore ? selectorForSibling(target.previousElementSibling) : selector,
    indicator: {
      left: showVerticalLine ? (placeBefore ? rect.left - 1 : rect.right - 1) : rect.left,
      top: showVerticalLine ? rect.top : placeBefore ? rect.top - 1 : rect.bottom - 1,
      width: showVerticalLine ? 3 : Math.max(24, rect.width),
      height: showVerticalLine ? Math.max(24, rect.height) : 3,
    },
  };
};

export const buildAreaOrderUpdates = (
  area: RegistryEntry,
  draggedElement: StructuredElementRecord,
  clientX: number,
  clientY: number,
  buildWithRules: BuildWithRulesFn,
) => {
  const content = area.content;
  if (!(content instanceof HTMLElement)) {
    return [draggedElement];
  }

  const allChildIds = Array.from(content.querySelectorAll(`[${HOST_ATTR}]`))
    .map((node) => (node instanceof HTMLElement ? node.getAttribute(HOST_ATTR) : ''))
    .filter((id): id is string => Boolean(id))
    .filter((id, index, source) => source.indexOf(id) === index)
    .filter((id) => id !== getEntryRuntime(area).id)
    .filter((id) => registry.has(id));

  const siblingIds = allChildIds.filter((id) => id !== draggedElement.id);
  const axis = getElementLayout(getEntryRuntime(area)) === 'column' ? 'column' : 'row';

  let insertIndex = siblingIds.length;
  for (let index = 0; index < siblingIds.length; index += 1) {
    const siblingEntry = registry.get(siblingIds[index]);
    if (!siblingEntry?.node) {
      continue;
    }
    const rect = siblingEntry.node.getBoundingClientRect();
    const center = axis === 'column' ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    const pointer = axis === 'column' ? clientY : clientX;
    if (pointer <= center) {
      insertIndex = index;
      break;
    }
  }

  const orderedIds = siblingIds.slice();
  orderedIds.splice(insertIndex, 0, draggedElement.id);

  const updates: StructuredElementRecord[] = [];
  orderedIds.forEach((id, index) => {
    const siblingEntry = registry.get(id);
    const baseElement = id === draggedElement.id ? draggedElement : siblingEntry?.element;
    if (!baseElement) {
      return;
    }
    const baseRuntime = toRuntimeElementPayload(baseElement);
    const rules = mergeStyleRules(baseRuntime);
    const nextOrder = String((index + 1) * 10);
    const previousOrder = rules.order?.trim() || '';
    rules.order = nextOrder;

    const next = buildWithRules(baseElement, baseRuntime, rules, {
      mode: 'container',
      containerId: getEntryRuntime(area).id,
    });
    if (
      id === draggedElement.id ||
      isElementFloating(baseRuntime) ||
      (getElementContainerId(baseRuntime) || '') !== getEntryRuntime(area).id ||
      previousOrder !== nextOrder
    ) {
      updates.push(next);
    }
  });

  return updates.length > 0 ? updates : [draggedElement];
};
