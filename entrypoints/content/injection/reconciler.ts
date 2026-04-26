import {
  MessageType,
} from '../../../shared/messages';
import { deriveSiteKey, type StructuredElementRecord } from '../../../shared/siteDataSchema';
import { executeBoundButtonAction } from './fileRun';
import {
  formatCustomCss,
  mergeStyleRules,
  normalizeStyleRules,
  parseCustomCss,
  POSITIONING_KEYS,
} from './style';
import {
  getElementActionFlowId,
  getElementActionSelector,
  getElementAfterSelector,
  getElementBeforeSelector,
  getElementContainerId,
  getElementHref,
  getElementLayout,
  getElementLinkTarget,
  getElementMode,
  getElementPosition,
  getElementSelector,
  getElementType,
  isElementFloating,
  normalizeSiteKey,
  toRuntimeElementPayload,
  type RuntimeElement,
} from './shared';
import {
  clearRenderOrder,
  deleteRenderOrder,
  ensureRenderOrder,
  getEditingElementId,
  getEntryRuntime,
  pendingPlacementById,
  pendingReattachIds,
  registry,
  setEditingElementId,
  setRenderOrderFromElements,
} from './registry';
import {
  applyHostContainerOrderStyle,
  applyHostPlacementStyles,
  createElementNode,
  insertNode,
  placeTooltip,
  removeExistingHosts,
  resolveTarget,
} from './hostFactory';
import {
  getDropIndicatorNode,
  hideDropIndicator,
  removeDropPreviewHost,
  setAreaHighlight,
  type BuildWithRulesFn,
} from './dropTargets';
import { startDragFor } from './dragController';
import { attachResizeHandles } from './resizeController';
import {
  EDITING_ATTR,
  FLOATING_Z_INDEX,
  HOST_ATTR,
  type RegistryEntry,
} from './types';

let reconcileTimer: number | null = null;
let reconcileObserver: MutationObserver | null = null;
let pendingPlacementTimer: number | null = null;

const applyEditingState = (entry: RegistryEntry) => {
  const runtime = getEntryRuntime(entry);
  const isEditing = runtime.id === getEditingElementId();
  entry.node.setAttribute(EDITING_ATTR, isEditing ? 'true' : 'false');
  entry.node.style.cursor = isEditing ? 'move' : '';
};

const applyEditingStateToAll = () => {
  registry.forEach((entry) => applyEditingState(entry));
};

const applyStableFloatingLayer = (entry: RegistryEntry) => {
  const runtime = getEntryRuntime(entry);
  if (!isElementFloating(runtime)) {
    return;
  }
  const styleRules = mergeStyleRules(runtime);
  const configured = styleRules.zIndex?.trim();
  if (configured) {
    entry.node.style.zIndex = configured;
    return;
  }
  const order = ensureRenderOrder(runtime.id);
  entry.node.style.zIndex = String(Number(FLOATING_Z_INDEX) + order);
};

const reattachContainerChildren = (containerId: string) => {
  const container = registry.get(containerId);
  if (!(container?.content instanceof HTMLElement)) {
    return;
  }
  const children = Array.from(registry.values()).filter((entry) => {
    const runtime = getEntryRuntime(entry);
    return runtime.id !== containerId && getElementContainerId(runtime) === containerId;
  });
  children.forEach((child) => {
    if (child.node.parentElement === container.content && child.node.isConnected) {
      return;
    }
    upsertElement(child.element);
  });
};

const postDraftUpdate = (element: StructuredElementRecord) => {
  const runtime = chrome?.runtime;
  if (!runtime?.sendMessage) {
    return;
  }
  runtime.sendMessage({
    type: MessageType.ELEMENT_DRAFT_UPDATED,
    data: { element },
  });
};

export const buildStructuredElementWithStyleRules: BuildWithRulesFn = (
  baseElement,
  baseRuntime,
  rules,
  patch,
) => {
  const normalizedRules = normalizeStyleRules(rules);
  const nextSelector = typeof patch.selector === 'string' ? patch.selector : getElementSelector(baseRuntime);
  const nextPosition =
    patch.position === 'append' || patch.position === 'prepend' || patch.position === 'before' || patch.position === 'after'
      ? patch.position
      : getElementPosition(baseRuntime);
  const hasBeforePatch = Object.prototype.hasOwnProperty.call(patch, 'beforeSelector');
  const hasAfterPatch = Object.prototype.hasOwnProperty.call(patch, 'afterSelector');
  const hasContainerPatch = Object.prototype.hasOwnProperty.call(patch, 'containerId');
  const nextBefore = hasBeforePatch
    ? typeof patch.beforeSelector === 'string' && patch.beforeSelector.trim()
      ? patch.beforeSelector
      : undefined
    : getElementBeforeSelector(baseRuntime);
  const nextAfter = hasAfterPatch
    ? typeof patch.afterSelector === 'string' && patch.afterSelector.trim()
      ? patch.afterSelector
      : undefined
    : getElementAfterSelector(baseRuntime);
  const nextContainerId = hasContainerPatch
    ? typeof patch.containerId === 'string' && patch.containerId.trim()
      ? patch.containerId
      : undefined
    : getElementContainerId(baseRuntime);
  let nextMode = patch.mode || getElementMode(baseRuntime);
  if (nextContainerId) {
    nextMode = 'container';
  } else if (nextMode === 'container') {
    nextMode = 'dom';
  }

  return {
    ...baseElement,
    placement: {
      ...baseElement.placement,
      mode: nextMode,
      selector: nextSelector,
      position: nextPosition,
      relativeTo: {
        before: nextBefore,
        after: nextAfter,
      },
      containerId: nextContainerId,
    },
    style: {
      ...baseElement.style,
      inline: normalizedRules,
      customCss: formatCustomCss(normalizedRules),
    },
    updatedAt: Date.now(),
  };
};

const filterRules = (element: RuntimeElement, omitPositioning: boolean) => {
  const rules = mergeStyleRules(element);
  if (!omitPositioning) {
    return rules;
  }
  const filtered: Record<string, string> = {};
  Object.entries(rules).forEach(([key, value]) => {
    if (!POSITIONING_KEYS.has(key)) {
      filtered[key] = value;
    }
  });
  return filtered;
};

const applyRuleMapToNode = (
  node: HTMLElement,
  previous: Record<string, string>,
  next: Record<string, string>,
) => {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  keys.forEach((key) => {
    const value = next[key];
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore style indexing
    node.style[key] = value ? value : '';
  });
};

const resetHostPlacementStyles = (host: HTMLElement) => {
  host.style.position = 'relative';
  host.style.left = '';
  host.style.top = '';
  host.style.right = '';
  host.style.bottom = '';
  host.style.zIndex = '';
};

const resolveExpectedParent = (next: RuntimeElement): HTMLElement | null => {
  const containerId = getElementContainerId(next);
  if (containerId) {
    const container = registry.get(containerId);
    return container?.content || null;
  }
  if (isElementFloating(next)) {
    return document.body;
  }

  const nextBeforeSelector = getElementBeforeSelector(next);
  const beforeNode = nextBeforeSelector ? resolveTarget(nextBeforeSelector) : null;
  if (beforeNode?.parentElement) {
    return beforeNode.parentElement;
  }
  const nextAfterSelector = getElementAfterSelector(next);
  const afterNode = nextAfterSelector ? resolveTarget(nextAfterSelector) : null;
  if (afterNode?.parentElement) {
    return afterNode.parentElement;
  }
  const target = resolveTarget(getElementSelector(next));
  if (!target) {
    return null;
  }
  const position = getElementPosition(next);
  if (position === 'before' || position === 'after') {
    return target.parentElement;
  }
  return target;
};

const isStructuralChange = (entry: RegistryEntry, next: RuntimeElement) => {
  const previous = getEntryRuntime(entry);
  if (getElementType(previous) !== getElementType(next)) {
    return true;
  }
  if (isElementFloating(previous) !== isElementFloating(next)) {
    return true;
  }
  if ((getElementContainerId(previous) || '') !== (getElementContainerId(next) || '')) {
    return true;
  }
  if ((getElementSelector(previous) || '') !== (getElementSelector(next) || '')) {
    return true;
  }
  if ((getElementPosition(previous) || 'append') !== (getElementPosition(next) || 'append')) {
    return true;
  }
  if ((getElementBeforeSelector(previous) || '') !== (getElementBeforeSelector(next) || '')) {
    return true;
  }
  if ((getElementAfterSelector(previous) || '') !== (getElementAfterSelector(next) || '')) {
    return true;
  }
  const expectedParent = resolveExpectedParent(next);
  if (!(expectedParent instanceof HTMLElement)) {
    return true;
  }
  if (entry.node.parentElement !== expectedParent) {
    return true;
  }
  return false;
};

const isContentCompatible = (entry: RegistryEntry, next: RuntimeElement) => {
  const current = getEntryRuntime(entry);
  if (getElementType(current) !== getElementType(next)) {
    return false;
  }
  const node = entry.content || entry.node;
  if (getElementType(next) === 'button') {
    return node instanceof HTMLButtonElement;
  }
  if (getElementType(next) === 'link') {
    return node instanceof HTMLAnchorElement;
  }
  return node instanceof HTMLElement;
};

const setNodeTextPreservingChildren = (node: HTMLElement, value: string) => {
  const textNodes = Array.from(node.childNodes).filter(
    (child): child is Text => child.nodeType === Node.TEXT_NODE,
  );
  if (textNodes.length > 0) {
    textNodes[0].nodeValue = value;
    textNodes.slice(1).forEach((textNode) => textNode.remove());
    return;
  }
  node.insertBefore(document.createTextNode(value), node.firstChild);
};

const syncContentAttributes = (entry: RegistryEntry, next: RuntimeElement) => {
  const node = entry.content || entry.node;
  if (getElementType(next) === 'button' && node instanceof HTMLButtonElement) {
    setNodeTextPreservingChildren(node, next.text || 'Button');
    return;
  }
  if (getElementType(next) === 'link' && node instanceof HTMLAnchorElement) {
    setNodeTextPreservingChildren(node, next.text || getElementHref(next) || 'Link');
    node.href = getElementHref(next) || '#';
    node.target = getElementLinkTarget(next) === 'same-tab' ? '_self' : '_blank';
    node.rel = 'noreferrer noopener';
    return;
  }
  if (getElementType(next) === 'tooltip' && node instanceof HTMLElement) {
    setNodeTextPreservingChildren(node, next.text || 'Tooltip');
    return;
  }
  if (getElementType(next) === 'area' && node instanceof HTMLElement) {
    node.style.flexDirection = getElementLayout(next) === 'column' ? 'column' : 'row';
  }
};

const syncElementStylesInPlace = (entry: RegistryEntry, next: RuntimeElement) => {
  const previous = getEntryRuntime(entry);
  const host = entry.node;
  const content = entry.content || host;
  if (isElementFloating(next)) {
    applyHostPlacementStyles(host, next);
    applyRuleMapToNode(content, filterRules(previous, true), filterRules(next, true));
  } else {
    resetHostPlacementStyles(host);
    applyRuleMapToNode(content, filterRules(previous, false), filterRules(next, false));
  }
  applyHostContainerOrderStyle(host, next);
};

export const persistElementMutation = (nextElement: StructuredElementRecord) => {
  const result = upsertElement(nextElement);
  if (!result.ok) {
    return result;
  }
  postDraftUpdate(nextElement);
  if (getEditingElementId() === nextElement.id) {
    setEditingElement(nextElement.id);
  }
  return { ok: true };
};

const queueDetachedEntryReconcile = (id: string) => {
  if (!id || !registry.has(id)) {
    return;
  }
  pendingReattachIds.add(id);
  if (reconcileTimer != null) {
    return;
  }
  reconcileTimer = window.setTimeout(() => {
    reconcileTimer = null;
    const pendingIds = Array.from(pendingReattachIds);
    pendingReattachIds.clear();
    pendingIds.forEach((pendingId) => {
      const entry = registry.get(pendingId);
      if (!entry || entry.node.isConnected) {
        return;
      }
      injectElement(entry.element);
    });
  }, 220);
};

const collectRemovedHostIds = (node: Node, sink: Set<string>) => {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const directId = node.getAttribute(HOST_ATTR);
  if (directId) {
    sink.add(directId);
  }
  node.querySelectorAll(`[${HOST_ATTR}]`).forEach((entry) => {
    if (entry instanceof HTMLElement) {
      const nestedId = entry.getAttribute(HOST_ATTR);
      if (nestedId) {
        sink.add(nestedId);
      }
    }
  });
};

const schedulePendingPlacementRetry = (delayMs = 220) => {
  if (pendingPlacementTimer != null) {
    return;
  }
  pendingPlacementTimer = window.setTimeout(() => {
    pendingPlacementTimer = null;
    const pendingElements = Array.from(pendingPlacementById.values());
    if (pendingElements.length === 0) {
      if (registry.size === 0) {
        stopDetachedEntryObserver();
      }
      return;
    }
    pendingPlacementById.clear();
    pendingElements.forEach((pendingElement) => {
      injectElement(pendingElement);
    });
    if (pendingPlacementById.size > 0) {
      schedulePendingPlacementRetry(320);
      return;
    }
    if (registry.size === 0) {
      stopDetachedEntryObserver();
    }
  }, delayMs);
};

const queuePendingPlacementRetry = (element: StructuredElementRecord, delayMs = 220) => {
  if (!element?.id) {
    return;
  }
  pendingPlacementById.set(element.id, element);
  ensureDetachedEntryObserver();
  schedulePendingPlacementRetry(delayMs);
};

const ensureDetachedEntryObserver = () => {
  if (reconcileObserver || typeof MutationObserver === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (!root) {
    return;
  }
  reconcileObserver = new MutationObserver((mutations) => {
    if (registry.size === 0 && pendingPlacementById.size === 0) {
      return;
    }
    const removedHostIds = new Set<string>();
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        collectRemovedHostIds(node, removedHostIds);
      });
    });
    removedHostIds.forEach((id) => {
      const entry = registry.get(id);
      if (!entry || entry.node.isConnected) {
        return;
      }
      queueDetachedEntryReconcile(id);
    });
    if (pendingPlacementById.size > 0) {
      schedulePendingPlacementRetry(80);
    }
  });
  reconcileObserver.observe(root, { childList: true, subtree: true });
};

export const stopDetachedEntryObserver = () => {
  if (reconcileTimer != null) {
    window.clearTimeout(reconcileTimer);
    reconcileTimer = null;
  }
  pendingReattachIds.clear();
  if (pendingPlacementTimer != null) {
    window.clearTimeout(pendingPlacementTimer);
    pendingPlacementTimer = null;
  }
  pendingPlacementById.clear();
  if (reconcileObserver) {
    reconcileObserver.disconnect();
    reconcileObserver = null;
  }
};

const controllerCallbacks = {
  injectElement: (element: StructuredElementRecord) => injectElement(element),
  setEditingElement: (id?: string) => setEditingElement(id),
  persistElementMutation,
  buildStructuredElementWithStyleRules,
};

const attachInteractions = (entry: RegistryEntry) => {
  const host = entry.node;
  const cleanupFns: Array<() => void> = [];
  const entryId = getEntryRuntime(entry).id;

  const resizeCleanup = attachResizeHandles(entry, controllerCallbacks);
  cleanupFns.push(resizeCleanup);

  const handlePointerDown = (event: PointerEvent) => {
    const path = event.composedPath();
    const isResizeHandle = path.some(
      (node) => node instanceof HTMLElement && Boolean(node.dataset?.ladybirdResizeHandle),
    );
    if (isResizeHandle) {
      return;
    }
    startDragFor(entryId, event, controllerCallbacks);
  };

  const handleClickCapture = (event: MouseEvent) => {
    if (getEditingElementId() !== entryId) {
      const liveEntry = registry.get(entryId);
      if (!liveEntry) {
        return;
      }
      const liveRuntime = getEntryRuntime(liveEntry);
      if (getElementType(liveRuntime) !== 'button') {
        return;
      }
      const hasBoundAction = Boolean(
        getElementActionFlowId(liveRuntime).trim() || getElementActionSelector(liveRuntime).trim(),
      );
      if (!hasBoundAction) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void executeBoundButtonAction(liveRuntime);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  host.addEventListener('pointerdown', handlePointerDown);
  host.addEventListener('click', handleClickCapture, true);

  cleanupFns.push(() => host.removeEventListener('pointerdown', handlePointerDown));
  cleanupFns.push(() => host.removeEventListener('click', handleClickCapture, true));

  return () => {
    cleanupFns.forEach((cleanup) => cleanup());
  };
};

export const injectElement = (element: StructuredElementRecord) => {
  if (!element?.id) {
    return { ok: false, error: 'invalid-element' };
  }
  const runtimeElement = toRuntimeElementPayload(element);
  ensureRenderOrder(element.id);

  const siteKey = normalizeSiteKey(deriveSiteKey(element.context.siteKey || ''));
  const currentSite = normalizeSiteKey(window.location.host || '');
  // Match on dot boundary so "evil-google.com" does not satisfy siteKey "google.com".
  const isSubdomainOf = siteKey && currentSite.endsWith(`.${siteKey}`);
  if (siteKey && currentSite && siteKey !== currentSite && !isSubdomainOf) {
    pendingPlacementById.delete(element.id);
    return { ok: false, error: 'site-mismatch' };
  }

  const { host, root, content } = createElementNode(runtimeElement);
  if (isElementFloating(runtimeElement)) {
    host.style.position = host.style.position || 'absolute';
    host.style.zIndex = host.style.zIndex || FLOATING_Z_INDEX;
  }

  const inserted = insertNode(host, runtimeElement);
  if (!inserted.ok) {
    host.remove();
    if (inserted.error === 'target-not-found' || inserted.error === 'container-not-found') {
      queuePendingPlacementRetry(element);
    } else {
      pendingPlacementById.delete(element.id);
    }
    return { ok: false, error: inserted.error || 'insert-failed' };
  }
  pendingPlacementById.delete(element.id);

  const existing = registry.get(element.id);
  if (existing) {
    existing.cleanup?.();
    if (existing.node !== host) {
      existing.node.remove();
    }
    registry.delete(element.id);
  }
  removeExistingHosts(element.id, host);

  const entry: RegistryEntry = { element, node: host, root, content };
  entry.cleanup = attachInteractions(entry);
  registry.set(element.id, entry);
  applyEditingState(entry);
  applyStableFloatingLayer(entry);
  ensureDetachedEntryObserver();

  if (getElementType(runtimeElement) === 'tooltip') {
    placeTooltip(runtimeElement);
  }
  if (getElementType(runtimeElement) === 'area') {
    reattachContainerChildren(element.id);
  }

  return { ok: true };
};

export const upsertElement = (element: StructuredElementRecord) => {
  const runtimeElement = toRuntimeElementPayload(element);
  const existing = registry.get(element.id);
  if (!existing) {
    return injectElement(element);
  }
  if (!isContentCompatible(existing, runtimeElement)) {
    return injectElement(element);
  }
  if (isStructuralChange(existing, runtimeElement)) {
    return injectElement(element);
  }

  syncContentAttributes(existing, runtimeElement);
  syncElementStylesInPlace(existing, runtimeElement);
  existing.element = element;
  applyEditingState(existing);
  applyStableFloatingLayer(existing);

  if (getElementType(runtimeElement) === 'tooltip') {
    placeTooltip(runtimeElement);
  }
  if (getElementType(runtimeElement) === 'area') {
    reattachContainerChildren(element.id);
  }
  return { ok: true };
};

export const removeElement = (id: string) => {
  const entry = registry.get(id);
  if (!entry) {
    return false;
  }
  entry.cleanup?.();
  entry.node.remove();
  registry.delete(id);
  deleteRenderOrder(id);
  pendingPlacementById.delete(id);
  if (getEditingElementId() === id) {
    setEditingElementId(null);
  }
  if (registry.size === 0 && pendingPlacementById.size === 0) {
    stopDetachedEntryObserver();
  }
  return true;
};

export const rehydrateElements = (elements: StructuredElementRecord[]) => {
  const previousEditingId = getEditingElementId();
  setRenderOrderFromElements(elements);
  const incomingIds = new Set(elements.map((element) => element.id));
  Array.from(pendingPlacementById.keys()).forEach((id) => {
    if (!incomingIds.has(id)) {
      pendingPlacementById.delete(id);
    }
  });
  Array.from(registry.keys()).forEach((id) => {
    if (!incomingIds.has(id)) {
      removeElement(id);
    }
  });

  const incomingRuntimeById = new Map(
    elements.map((element) => [element.id, toRuntimeElementPayload(element)]),
  );
  const pending = elements.slice();
  let progressed = true;
  while (pending.length > 0 && progressed) {
    progressed = false;
    for (let index = 0; index < pending.length; ) {
      const element = pending[index];
      const runtimeElement = incomingRuntimeById.get(element.id);
      if (
        runtimeElement &&
        getElementContainerId(runtimeElement) &&
        incomingRuntimeById.has(getElementContainerId(runtimeElement) as string) &&
        !registry.has(getElementContainerId(runtimeElement) as string)
      ) {
        index += 1;
        continue;
      }
      const result = upsertElement(element);
      if (!result.ok) {
        index += 1;
        continue;
      }
      pending.splice(index, 1);
      progressed = true;
    }
  }
  pending.forEach((element) => {
    upsertElement(element);
  });
  setEditingElementId(
    previousEditingId && registry.has(previousEditingId) ? previousEditingId : null,
  );
  applyEditingStateToAll();
};

export const setEditingElement = (id?: string) => {
  setEditingElementId(id || null);
  applyEditingStateToAll();
  if (!getEditingElementId()) {
    hideDropIndicator();
    removeDropPreviewHost();
    setAreaHighlight(null);
  }
};

export const resetAllInjectionState = () => {
  setEditingElement(undefined);
  Array.from(registry.keys()).forEach((id) => removeElement(id));
  clearRenderOrder();
  const dropIndicatorNode = getDropIndicatorNode();
  if (dropIndicatorNode?.isConnected) {
    dropIndicatorNode.remove();
  }
  // indicator node reset via hideDropIndicator in setEditingElement; ensure timer/observer off
  stopDetachedEntryObserver();
};

