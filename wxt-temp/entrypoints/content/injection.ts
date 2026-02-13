import {
  MessageType,
  type FlowRunDataSourceInput,
  type FlowRunFlowSnapshot,
  type RuntimeMessage,
} from '../../shared/messages';
import { getSiteData } from '../../shared/storage';
import {
  deriveSiteKey,
  type StructuredElementRecord,
} from '../../shared/siteDataSchema';
import { generateSelector, selectorForSibling } from './injection/selector';
import {
  applyInlineStyles,
  formatCustomCss,
  mergeStyleRules,
  normalizeStyleRules,
  parseCustomCss,
  POSITIONING_KEYS,
} from './injection/style';
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
  getElementTooltipPosition,
  getElementType,
  isElementFloating,
  isRecord,
  normalizeSiteKey,
  toFlowSnapshot,
  toRuntimeElementPayload,
  toStructuredElementPayload,
  type RuntimeElement,
} from './injection/shared';

type RegistryEntry = {
  element: StructuredElementRecord;
  node: HTMLElement;
  root?: ShadowRoot;
  content?: HTMLElement;
  cleanup?: () => void;
};

type RuntimeMessenger = { sendMessage?: (message: unknown) => void };

type DropIndicator = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type DomDropPlacement = {
  reference: HTMLElement;
  selector: string;
  position: 'before' | 'after' | 'append';
  beforeSelector?: string;
  afterSelector?: string;
  indicator: DropIndicator;
};

type ElementMutationPatch = {
  selector?: string;
  position?: StructuredElementRecord['placement']['position'];
  beforeSelector?: string;
  afterSelector?: string;
  containerId?: string;
  mode?: StructuredElementRecord['placement']['mode'];
};

const registry = new Map<string, RegistryEntry>();
const HOST_ATTR = 'data-ladybird-element';
const EDITING_ATTR = 'data-ladybird-editing';
const HIGHLIGHT_COLOR = 'rgba(27, 132, 255, 0.55)';
const FLOATING_Z_INDEX = '2147482000';
const DRAG_Z_INDEX = '2147483200';
const MIN_SIZE = 24;

let editingElementId: string | null = null;
let highlightedAreaId: string | null = null;
let dropIndicatorNode: HTMLElement | null = null;
let dropPreviewHost: HTMLElement | null = null;
let dropPreviewSourceId: string | null = null;
let renderOrderCounter = 0;
const renderOrderById = new Map<string, number>();
let reconcileTimer: number | null = null;
let reconcileObserver: MutationObserver | null = null;
const pendingReattachIds = new Set<string>();
let pendingPlacementTimer: number | null = null;
const pendingPlacementById = new Map<string, StructuredElementRecord>();

const getEntryRuntime = (entry: RegistryEntry): RuntimeElement => toRuntimeElementPayload(entry.element);

const setRenderOrderFromElements = (elements: StructuredElementRecord[]) => {
  renderOrderById.clear();
  elements.forEach((element, index) => {
    renderOrderById.set(element.id, index);
  });
  renderOrderCounter = elements.length;
};

const ensureRenderOrder = (id: string) => {
  const existing = renderOrderById.get(id);
  if (typeof existing === 'number') {
    return existing;
  }
  const next = renderOrderCounter;
  renderOrderCounter += 1;
  renderOrderById.set(id, next);
  return next;
};


const applyHostPlacementStyles = (host: HTMLElement, element: RuntimeElement) => {
  const merged = mergeStyleRules(element);
  const nextPosition = merged.position?.trim();
  host.style.position = nextPosition || (isElementFloating(element) ? 'absolute' : host.style.position || 'relative');
  host.style.left = merged.left?.trim() || '';
  host.style.top = merged.top?.trim() || '';
  host.style.right = merged.right?.trim() || '';
  host.style.bottom = merged.bottom?.trim() || '';
  host.style.zIndex = merged.zIndex?.trim() || '';
};

const applyHostContainerOrderStyle = (host: HTMLElement, element: RuntimeElement) => {
  const rules = mergeStyleRules(element);
  const order = rules.order?.trim() || '';
  host.style.order = getElementContainerId(element) ? order : '';
};

const stripPositioningFromStyle = (style?: RuntimeElement['style']) => {
  const merged = {
    ...(style?.inline || {}),
    ...parseCustomCss(style?.customCss || ''),
  };
  delete merged.position;
  delete merged.left;
  delete merged.top;
  delete merged.right;
  delete merged.bottom;
  delete merged.zIndex;
  const normalized = normalizeStyleRules(merged);
  return {
    preset: style?.preset,
    inline: normalized,
    customCss: formatCustomCss(normalized),
  };
};

const createHostWithShadow = (element: RuntimeElement) => {
  const host = document.createElement('div');
  host.setAttribute(HOST_ATTR, element.id);
  host.setAttribute(EDITING_ATTR, 'false');
  host.dataset.type = getElementType(element);
  host.dataset.shadow = 'true';
  host.style.position = 'relative';
  host.style.boxSizing = 'border-box';
  host.style.display = 'inline-block';
  host.style.pointerEvents = 'auto';

  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      display: inline-block;
      box-sizing: border-box;
      position: relative;
      pointer-events: auto;
      vertical-align: top;
    }
    * { box-sizing: border-box; }
    .ladybird-reset {
      all: unset;
      box-sizing: border-box;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      line-height: 1.4;
      pointer-events: auto;
    }
    .ladybird-edit-target {
      display: block;
      width: auto;
      min-height: 1px;
    }
    :host([data-ladybird-editing='true']) .ladybird-edit-target {
      outline: 2px dashed rgba(27, 132, 255, 0.8);
      outline-offset: 2px;
    }
    .ladybird-area {
      background: rgba(46, 125, 50, 0.08);
      border: 1px dashed rgba(46, 125, 50, 0.4);
      border-radius: 14px;
      padding: 10px;
      color: #0f172a;
      min-height: 48px;
      display: flex;
      gap: 8px;
    }
    .ladybird-area.ladybird-area-drop-target {
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.42) inset;
      background: rgba(34, 197, 94, 0.12);
    }
    .ladybird-button {
      background: #1b84ff;
      color: #ffffff;
      border-radius: 8px;
      padding: 8px 16px;
      font-weight: 600;
      font-size: 12px;
      border: none;
      cursor: pointer;
    }
    .ladybird-link {
      color: #2563eb;
      text-decoration: underline;
      font-size: 12px;
      cursor: pointer;
    }
    .ladybird-tooltip {
      background: #0f172a;
      color: #ffffff;
      border-radius: 10px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      pointer-events: none;
    }
    .ladybird-resize-handle {
      position: absolute;
      width: 11px;
      height: 11px;
      border-radius: 9999px;
      border: 1px solid #ffffff;
      background: #1b84ff;
      box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.25);
      z-index: 3;
      display: none;
      pointer-events: auto;
    }
    :host([data-ladybird-editing='true']) .ladybird-resize-handle {
      display: block;
    }
    .ladybird-resize-handle[data-ladybird-resize-handle='e'] {
      right: -6px;
      top: 50%;
      transform: translate(50%, -50%);
      cursor: ew-resize;
    }
    .ladybird-resize-handle[data-ladybird-resize-handle='s'] {
      left: 50%;
      bottom: -6px;
      transform: translate(-50%, 50%);
      cursor: ns-resize;
    }
    .ladybird-resize-handle[data-ladybird-resize-handle='se'] {
      right: -6px;
      bottom: -6px;
      transform: translate(50%, 50%);
      cursor: nwse-resize;
    }
  `;
  root.appendChild(style);
  return { host, root };
};

const createElementNode = (element: RuntimeElement) => {
  const { host, root } = createHostWithShadow(element);
  let node: HTMLElement;

  switch (getElementType(element)) {
    case 'button': {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = element.text || 'Button';
      button.className = 'ladybird-reset ladybird-edit-target ladybird-button';
      node = button;
      break;
    }
    case 'link': {
      const anchor = document.createElement('a');
      anchor.textContent = element.text || getElementHref(element) || 'Link';
      anchor.href = getElementHref(element) || '#';
      anchor.target = getElementLinkTarget(element) === 'same-tab' ? '_self' : '_blank';
      anchor.rel = 'noreferrer noopener';
      anchor.className = 'ladybird-reset ladybird-edit-target ladybird-link';
      node = anchor;
      break;
    }
    case 'tooltip': {
      const tooltip = document.createElement('div');
      tooltip.textContent = element.text || 'Tooltip';
      tooltip.className = 'ladybird-reset ladybird-edit-target ladybird-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.zIndex = '2147482001';
      node = tooltip;
      break;
    }
    case 'area':
    default: {
      const area = document.createElement('div');
      area.className = 'ladybird-reset ladybird-edit-target ladybird-area';
      area.style.flexDirection = getElementLayout(element) === 'column' ? 'column' : 'row';
      node = area;
      break;
    }
  }

  if (isElementFloating(element)) {
    applyHostPlacementStyles(host, element);
    applyInlineStyles(node, element, { omitPositioning: true });
  } else {
    applyInlineStyles(node, element);
  }
  applyHostContainerOrderStyle(host, element);

  root.appendChild(node);
  return { host, root, content: node };
};

const resolveTarget = (selector?: string) => {
  if (!selector) {
    return null;
  }
  try {
    return document.querySelector(selector) as HTMLElement | null;
  } catch {
    return null;
  }
};

const removeExistingHosts = (id: string, exceptNode?: HTMLElement) => {
  const selector = `[${HOST_ATTR}="${id}"]`;
  document.querySelectorAll(selector).forEach((node) => {
    if (node instanceof HTMLElement && node !== exceptNode) {
      node.remove();
    }
  });
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

const stopDetachedEntryObserver = () => {
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

const insertNode = (host: HTMLElement, element: RuntimeElement) => {
  const containerId = getElementContainerId(element);
  const containerEntry = containerId ? registry.get(containerId) : null;
  const containerTarget = containerEntry?.content || containerEntry?.node || null;
  if (containerTarget) {
    containerTarget.appendChild(host);
    return { ok: true };
  }
  if (containerId && !containerTarget) {
    return { ok: false, error: 'container-not-found' };
  }

  if (isElementFloating(element)) {
    if (!host.style.position || host.style.position === 'relative') {
      host.style.position = 'absolute';
    }
    if (!host.style.zIndex) {
      host.style.zIndex = FLOATING_Z_INDEX;
    }
    document.body.appendChild(host);
    return { ok: true };
  }

  const beforeNode = getElementBeforeSelector(element) ? resolveTarget(getElementBeforeSelector(element)) : null;
  if (beforeNode?.parentElement) {
    beforeNode.parentElement.insertBefore(host, beforeNode);
    return { ok: true };
  }

  const afterNode = getElementAfterSelector(element) ? resolveTarget(getElementAfterSelector(element)) : null;
  if (afterNode?.parentElement) {
    if (afterNode.nextSibling) {
      afterNode.parentElement.insertBefore(host, afterNode.nextSibling);
    } else {
      afterNode.parentElement.appendChild(host);
    }
    return { ok: true };
  }

  const selector = getElementSelector(element);
  const target = resolveTarget(selector);
  if (!target || !target.parentElement) {
    if (!selector && getElementType(element) !== 'tooltip') {
      document.body.appendChild(host);
      return { ok: true };
    }
    return { ok: false, error: 'target-not-found' };
  }

  const position = getElementPosition(element);
  if (position === 'prepend') {
    target.insertBefore(host, target.firstChild);
    return { ok: true };
  }
  if (position === 'before') {
    target.parentElement.insertBefore(host, target);
    return { ok: true };
  }
  if (position === 'after') {
    if (target.nextSibling) {
      target.parentElement.insertBefore(host, target.nextSibling);
    } else {
      target.parentElement.appendChild(host);
    }
    return { ok: true };
  }

  target.appendChild(host);
  return { ok: true };
};

const placeTooltip = (element: RuntimeElement) => {
  const target = resolveTarget(getElementSelector(element));
  const entry = registry.get(element.id);
  const tooltip = entry?.content || null;
  if (!(target instanceof HTMLElement) || !(tooltip instanceof HTMLElement)) {
    return;
  }
  const rect = target.getBoundingClientRect();
  const offset = 6;
  const position = getElementTooltipPosition(element) || 'top';
  const top =
    position === 'top'
      ? rect.top - offset
      : position === 'bottom'
        ? rect.bottom + offset
        : rect.top;
  const left =
    position === 'left'
      ? rect.left - offset
      : position === 'right'
        ? rect.right + offset
        : rect.left;

  tooltip.style.position = 'fixed';
  tooltip.style.top = `${Math.max(0, top)}px`;
  tooltip.style.left = `${Math.max(0, left)}px`;
  tooltip.style.zIndex = '2147482001';
};

const setAreaHighlight = (nextId: string | null) => {
  if (highlightedAreaId && highlightedAreaId !== nextId) {
    const previous = registry.get(highlightedAreaId);
    previous?.content?.classList.remove('ladybird-area-drop-target');
  }
  highlightedAreaId = nextId;
  if (nextId) {
    const next = registry.get(nextId);
    next?.content?.classList.add('ladybird-area-drop-target');
  }
};

const ensureDropIndicator = () => {
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

const showDropIndicator = (indicator: DropIndicator) => {
  void indicator;
};

const hideDropIndicator = () => {
  if (dropIndicatorNode?.isConnected) {
    dropIndicatorNode.remove();
  }
  dropIndicatorNode = null;
};

const removeDropPreviewHost = () => {
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

const showAreaDropPreview = (dropTarget: RegistryEntry, element: RuntimeElement) => {
  if (!(dropTarget.content instanceof HTMLElement)) {
    return;
  }
  const preview = ensureDropPreviewHost(element);
  if (preview.parentElement !== dropTarget.content) {
    dropTarget.content.appendChild(preview);
  }
};

const showDomDropPreview = (placement: DomDropPlacement, element: RuntimeElement) => {
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

const applyEditingState = (entry: RegistryEntry) => {
  const runtime = getEntryRuntime(entry);
  const isEditing = runtime.id === editingElementId;
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
  const children = Array.from(registry.values()).filter(
    (entry) => {
      const runtime = getEntryRuntime(entry);
      return runtime.id !== containerId && getElementContainerId(runtime) === containerId;
    },
  );
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

const sendRuntimeMessage = async (message: RuntimeMessage) => {
  const runtime = chrome?.runtime;
  if (!runtime?.sendMessage) {
    return { ok: false, error: 'runtime-unavailable' } as const;
  }
  return new Promise<{ ok: boolean; data?: unknown; error?: string }>((resolve) => {
    runtime.sendMessage(message, (response) => {
      const lastError = chrome?.runtime?.lastError?.message;
      if (lastError) {
        resolve({ ok: false, error: lastError });
        return;
      }
      if (isRecord(response) && 'ok' in response) {
        const typed = response as { ok?: boolean; data?: unknown; error?: string };
        resolve({
          ok: typed.ok !== false,
          data: typed.data,
          error: typed.error,
        });
        return;
      }
      resolve({ ok: true, data: response });
    });
  });
};

const triggerSelectorAction = (selector: string) => {
  if (!selector.trim()) {
    return false;
  }
  let target: Element | null = null;
  try {
    target = document.querySelector(selector);
  } catch {
    return false;
  }
  if (!target) {
    return false;
  }
  if (target instanceof HTMLElement) {
    target.click();
    return true;
  }
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
};

type DataSourceStepDescriptor = {
  id: string;
  title: string;
  fileType: 'csv' | 'tsv';
};

const inferDataSourceFileType = (fileName: string, fallback: 'csv' | 'tsv') => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.tsv')) {
    return 'tsv';
  }
  if (lower.endsWith('.csv')) {
    return 'csv';
  }
  return fallback;
};

const collectDataSourceSteps = (
  steps: FlowRunFlowSnapshot['steps'],
  sink: DataSourceStepDescriptor[] = [],
): DataSourceStepDescriptor[] => {
  for (const step of steps) {
    if (step.type === 'data-source') {
      sink.push({
        id: step.id,
        title: step.title || step.id,
        fileType: step.dataSource?.fileType === 'tsv' ? 'tsv' : 'csv',
      });
    }
    if (Array.isArray(step.children) && step.children.length > 0) {
      collectDataSourceSteps(step.children, sink);
    }
    if (Array.isArray(step.branches) && step.branches.length > 0) {
      for (const branch of step.branches) {
        collectDataSourceSteps(branch.steps ?? [], sink);
      }
    }
  }
  return sink;
};

const requestFileForDataSourceStep = (step: DataSourceStepDescriptor): Promise<File | null> => {
  return new Promise((resolve) => {
    if (!document.body) {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = step.fileType === 'tsv' ? '.tsv,text/tab-separated-values,text/plain' : '.csv,text/csv,text/plain';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    let settled = false;

    const finish = (file: File | null) => {
      if (settled) {
        return;
      }
      settled = true;
      input.removeEventListener('change', handleChange);
      input.removeEventListener('cancel', handleCancel as EventListener);
      input.remove();
      resolve(file);
    };

    const handleChange = () => {
      finish(input.files?.[0] ?? null);
    };

    const handleCancel = () => {
      finish(null);
    };

    input.addEventListener('change', handleChange);
    input.addEventListener('cancel', handleCancel as EventListener);
    document.body.appendChild(input);

    const proceed = window.confirm(`Select CSV/TSV for step: ${step.title}`);
    if (!proceed) {
      finish(null);
      return;
    }

    input.click();
  });
};

const collectDataSourceInputsForRun = async (snapshot: FlowRunFlowSnapshot) => {
  const stepDescriptors = collectDataSourceSteps(snapshot.steps);
  if (stepDescriptors.length === 0) {
    return {} as Record<string, FlowRunDataSourceInput>;
  }
  const selectedInputs: Record<string, FlowRunDataSourceInput> = {};
  for (const step of stepDescriptors) {
    const file = await requestFileForDataSourceStep(step);
    if (!file) {
      throw new Error('data-source-selection-cancelled');
    }
    selectedInputs[step.id] = {
      fileName: file.name,
      fileType: inferDataSourceFileType(file.name, step.fileType),
      rawText: await file.text(),
    };
  }
  return selectedInputs;
};

const startBoundFlowRun = async (element: RuntimeElement) => {
  const flowId = getElementActionFlowId(element).trim();
  if (!flowId) {
    return { ok: false, error: 'action-flow-missing' } as const;
  }
  const fallbackSiteKey = normalizeSiteKey(window.location.host || '');
  const siteKey = normalizeSiteKey(deriveSiteKey(element.context.siteKey || '') || fallbackSiteKey);
  if (!siteKey) {
    return { ok: false, error: 'site-key-missing' } as const;
  }
  const siteData = await getSiteData(siteKey);
  const matchedFlow = siteData.flows.find((flow) => flow?.id === flowId);
  const snapshot = toFlowSnapshot(matchedFlow, siteKey);
  if (!snapshot) {
    return { ok: false, error: `flow-not-found:${flowId}` } as const;
  }
  let dataSourceInputs: Record<string, FlowRunDataSourceInput> = {};
  try {
    dataSourceInputs = await collectDataSourceInputsForRun(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'data-source-selection-cancelled' } as const;
  }
  return sendRuntimeMessage({
    type: MessageType.START_FLOW_RUN,
    data: {
      flow: snapshot,
      source: 'flows-list',
      dataSourceInputs,
    },
  });
};

const executeBoundButtonAction = async (element: RuntimeElement) => {
  const flowId = getElementActionFlowId(element).trim();
  if (flowId) {
    const response = await startBoundFlowRun(element);
    if (!response.ok) {
      if (response.error === 'data-source-selection-cancelled') {
        return;
      }
      console.warn('Failed to start bound flow run', {
        flowId,
        error: response.error || 'unknown-error',
      });
    }
    return;
  }

  const actionSelector = getElementActionSelector(element).trim();
  if (!actionSelector) {
    return;
  }
  if (!triggerSelectorAction(actionSelector)) {
    console.warn('Failed to trigger bound action selector', { selector: actionSelector });
  }
};

const buildStructuredElementWithStyleRules = (
  baseElement: StructuredElementRecord,
  baseRuntime: RuntimeElement,
  rules: Record<string, string>,
  patch: ElementMutationPatch,
): StructuredElementRecord => {
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

const findAreaDropTarget = (clientX: number, clientY: number, excludeId: string) => {
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

const buildAreaOrderUpdates = (
  area: RegistryEntry,
  draggedElement: StructuredElementRecord,
  clientX: number,
  clientY: number,
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

    const next = buildStructuredElementWithStyleRules(baseElement, baseRuntime, rules, {
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

const findDomDropTarget = (clientX: number, clientY: number, draggedHost: HTMLElement) => {
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

const resolveDomDropPlacement = (target: HTMLElement | null, clientX: number, clientY: number): DomDropPlacement | null => {
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

const persistElementMutation = (nextElement: StructuredElementRecord) => {
  const result = upsertElement(nextElement);
  if (!result.ok) {
    return result;
  }
  postDraftUpdate(nextElement);
  if (editingElementId === nextElement.id) {
    setEditingElement(nextElement.id);
  }
  return { ok: true };
};

const attachInteractions = (entry: RegistryEntry) => {
  const host = entry.node;
  const root = entry.root;
  const content = entry.content || host;
  const cleanupFns: Array<() => void> = [];
  const entryId = getEntryRuntime(entry).id;

  const isEditing = () => editingElementId === entryId;

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
    const liveRuntime = getEntryRuntime(liveEntry);

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
        injectElement(liveEntry.element);
        if (editingElementId === liveRuntime.id) {
          setEditingElement(liveRuntime.id);
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

      const nextElement = buildStructuredElementWithStyleRules(
        finalEntry.element,
        finalRuntime,
        styleRules,
        {},
      );
      persistElementMutation(nextElement);
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

  const startDrag = (event: PointerEvent) => {
    if (!isEditing()) {
      return;
    }
    if (event.button !== 0 && event.button !== -1) {
      return;
    }

    const liveEntry = registry.get(entryId);
    if (!liveEntry) {
      return;
    }
    const liveRuntime = getEntryRuntime(liveEntry);

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
        injectElement(liveEntry.element);
        if (editingElementId === liveRuntime.id) {
          setEditingElement(liveRuntime.id);
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
        const nextElement = buildStructuredElementWithStyleRules(
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
        persistElementMutation(nextElement);
        return;
      }

      if (currentArea) {
        delete styleRules.position;
        delete styleRules.left;
        delete styleRules.top;
        delete styleRules.zIndex;
        const currentAreaRuntime = getEntryRuntime(currentArea);
        const nextElement = buildStructuredElementWithStyleRules(
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
        const updates = buildAreaOrderUpdates(currentArea, nextElement, lastPointerX, lastPointerY);
        updates.forEach((item) => {
          persistElementMutation(item);
        });
        return;
      }

      if (currentPlacement) {
        delete styleRules.position;
        delete styleRules.left;
        delete styleRules.top;
        delete styleRules.zIndex;
        delete styleRules.order;
        const nextElement = buildStructuredElementWithStyleRules(
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
        persistElementMutation(nextElement);
        return;
      }

      styleRules.position = 'absolute';
      styleRules.left = `${Math.round(lastLeft)}px`;
      styleRules.top = `${Math.round(lastTop)}px`;
      delete styleRules.order;
      if (!styleRules.zIndex) {
        styleRules.zIndex = FLOATING_Z_INDEX;
      }
      const nextElement = buildStructuredElementWithStyleRules(
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
      persistElementMutation(nextElement);
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

  const handlePointerDown = (event: PointerEvent) => {
    const path = event.composedPath();
    const isResizeHandle = path.some(
      (node) => node instanceof HTMLElement && Boolean(node.dataset?.ladybirdResizeHandle),
    );
    if (isResizeHandle) {
      return;
    }
    startDrag(event);
  };

  const handleClickCapture = (event: MouseEvent) => {
    if (!isEditing()) {
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

const injectElement = (element: StructuredElementRecord) => {
  if (!element?.id) {
    return { ok: false, error: 'invalid-element' };
  }
  const runtimeElement = toRuntimeElementPayload(element);
  ensureRenderOrder(element.id);

  const siteKey = normalizeSiteKey(deriveSiteKey(element.context.siteKey || ''));
  const currentSite = normalizeSiteKey(window.location.host || '');
  if (siteKey && currentSite && siteKey !== currentSite && !currentSite.endsWith(siteKey)) {
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

const upsertElement = (element: StructuredElementRecord) => {
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

const removeElement = (id: string) => {
  const entry = registry.get(id);
  if (!entry) {
    return false;
  }
  entry.cleanup?.();
  entry.node.remove();
  registry.delete(id);
  renderOrderById.delete(id);
  pendingPlacementById.delete(id);
  if (editingElementId === id) {
    editingElementId = null;
  }
  if (registry.size === 0 && pendingPlacementById.size === 0) {
    stopDetachedEntryObserver();
  }
  return true;
};

const rehydrateElements = (elements: StructuredElementRecord[]) => {
  const previousEditingId = editingElementId;
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
  editingElementId = previousEditingId && registry.has(previousEditingId) ? previousEditingId : null;
  applyEditingStateToAll();
};

const blinkHighlight = (node: HTMLElement) => {
  const rect = node.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.boxSizing = 'border-box';
  overlay.style.background = HIGHLIGHT_COLOR;
  overlay.style.backdropFilter = 'saturate(1.1)';
  overlay.style.border = '2px solid rgba(27, 132, 255, 0.65)';
  overlay.style.zIndex = '2147483646';
  overlay.style.top = `${Math.round(rect.top) - 5}px`;
  overlay.style.left = `${Math.round(rect.left) - 5}px`;
  overlay.style.width = `${Math.round(rect.width) + 10}px`;
  overlay.style.height = `${Math.round(rect.height) + 10}px`;
  overlay.style.opacity = '0.38';
  overlay.style.transition = 'opacity 100ms ease, transform 100ms ease';
  overlay.style.transform = 'scale(1)';
  document.body.appendChild(overlay);

  let visible = true;
  let ticks = 0;
  const timer = window.setInterval(() => {
    visible = !visible;
    overlay.style.opacity = visible ? '0.38' : '0.08';
    overlay.style.transform = visible ? 'scale(1)' : 'scale(0.995)';
    ticks += 1;
    if (ticks >= 6) {
      window.clearInterval(timer);
      overlay.remove();
    }
  }, 120);
};

const highlightElement = (id: string) => {
  const entry = registry.get(id);
  if (!entry?.node) {
    return false;
  }
  const preferred = entry.content || entry.node;
  const preferredRect = preferred.getBoundingClientRect();
  const target =
    preferredRect.width > 0 && preferredRect.height > 0
      ? preferred
      : entry.node;
  const rect = target.getBoundingClientRect();
  const nextTop = rect.top + window.scrollY - (window.innerHeight - rect.height) / 2;
  const nextLeft = rect.left + window.scrollX - (window.innerWidth - rect.width) / 2;
  window.scrollTo({
    top: Math.max(0, Math.round(nextTop)),
    left: Math.max(0, Math.round(nextLeft)),
    behavior: 'auto',
  });
  requestAnimationFrame(() => {
    blinkHighlight(target);
  });
  return true;
};

const setEditingElement = (id?: string) => {
  editingElementId = id || null;
  applyEditingStateToAll();
  if (!editingElementId) {
    hideDropIndicator();
    removeDropPreviewHost();
    setAreaHighlight(null);
  }
};

export const handleInjectionMessage = (message: RuntimeMessage) => {
  switch (message.type) {
    case MessageType.CREATE_ELEMENT: {
      const element = toStructuredElementPayload(message.data?.element);
      if (!element) {
        return { ok: false, error: 'invalid-element' };
      }
      return injectElement(element);
    }
    case MessageType.UPDATE_ELEMENT:
    case MessageType.PREVIEW_ELEMENT: {
      const element = toStructuredElementPayload(message.data?.element);
      if (!element) {
        return { ok: false, error: 'invalid-element' };
      }
      return upsertElement(element);
    }
    case MessageType.DELETE_ELEMENT: {
      const id = message.data?.id;
      if (!id) {
        return { ok: false, error: 'invalid-element-id' };
      }
      removeElement(id);
      return { ok: true };
    }
    case MessageType.REHYDRATE_ELEMENTS: {
      const elements = Array.isArray(message.data?.elements)
        ? message.data.elements
            .map((entry) => toStructuredElementPayload(entry))
            .filter((entry): entry is StructuredElementRecord => Boolean(entry))
        : [];
      rehydrateElements(elements);
      return { ok: true };
    }
    case MessageType.FOCUS_ELEMENT: {
      const id = message.data?.id;
      if (!id) {
        return { ok: false, error: 'invalid-element-id' };
      }
      const focused = highlightElement(id);
      return { ok: focused, error: focused ? undefined : 'element-not-found' };
    }
    case MessageType.SET_EDITING_ELEMENT: {
      setEditingElement(message.data?.id);
      return { ok: true };
    }
    default:
      return undefined;
  }
};

export const resetInjectionRegistry = () => {
  setEditingElement(undefined);
  Array.from(registry.keys()).forEach((id) => removeElement(id));
  renderOrderById.clear();
  renderOrderCounter = 0;
  if (dropIndicatorNode?.isConnected) {
    dropIndicatorNode.remove();
  }
  dropIndicatorNode = null;
  stopDetachedEntryObserver();
};

export const registerPageContextIfNeeded = (runtime?: RuntimeMessenger) => {
  if (!runtime?.sendMessage) {
    return;
  }
  if (window.top !== window) {
    return;
  }
  const href = window.location.href;
  if (!href) {
    return;
  }
  runtime.sendMessage({
    type: MessageType.PAGE_CONTEXT_PING,
    data: { url: href, title: document.title || undefined },
  });
};

