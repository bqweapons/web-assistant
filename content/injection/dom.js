import { parseActionFlowDefinition } from '../../common/flows.js';
import { HOST_ATTRIBUTE, HOST_CLASS, NODE_CLASS } from './constants.js';
import { executeActionFlow } from './flow-runner.js';
import { applyBaseAppearance, applyStyle, getStyleTarget, normalizeTooltipPosition } from './style.js';
import {
  applyTooltipAppearance,
  configureTooltipPosition,
  createTooltipNode,
  bindTooltipViewportGuards,
} from './tooltip.js';
import { forwardClick, resolveSelector, sanitizeUrl } from './utils.js';
import { generateSelector } from '../selector/utils.js';

/** @type {Map<string, { host: HTMLElement; containerId: string }>} */
const pendingContainerAttachments = new Map();
let pendingContainerRetryHandle = 0;

const VOID_ELEMENT_TAGS = new Set([
  'AREA',
  'BASE',
  'BR',
  'COL',
  'EMBED',
  'HR',
  'IMG',
  'INPUT',
  'KEYGEN',
  'LINK',
  'META',
  'PARAM',
  'SOURCE',
  'TRACK',
  'WBR',
]);
const AUGMENTOR_ROOT_SELECTOR = '[data-page-augmentor-root]';

/** @type {HTMLElement | null} */
let domDropIndicator = null;
/** @type {HTMLElement | null} */
let dropPreviewHost = null;
let dropPreviewSourceId = '';

function ensureDomDropIndicator() {
  if (domDropIndicator && domDropIndicator.isConnected) {
    return domDropIndicator;
  }
  const indicator = document.createElement('div');
  indicator.dataset.pageAugmentorRoot = 'drop-indicator';
  Object.assign(indicator.style, {
    position: 'fixed',
    zIndex: '2147482001',
    pointerEvents: 'none',
    borderRadius: '10px',
    border: '2px dashed rgba(37, 99, 235, 0.55)',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    boxSizing: 'border-box',
    display: 'none',
    transition: 'none',
  });
  document.body.appendChild(indicator);
  domDropIndicator = indicator;
  return indicator;
}

function showDomDropIndicator(indicator) {
  if (!indicator) {
    hideDomDropIndicator();
    return;
  }
  const node = ensureDomDropIndicator();
  if (!node.isConnected) {
    document.body.appendChild(node);
  }
  const { top, left, width, height, mode } = indicator;
  const safeTop = Number.isFinite(top) ? Math.max(0, top) : 0;
  const safeLeft = Number.isFinite(left) ? Math.max(0, left) : 0;
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const minHeight = mode === 'line' ? 2 : 4;
  const safeHeight = Number.isFinite(height) ? Math.max(minHeight, height) : minHeight;
  node.style.display = 'block';
  node.style.left = `${Math.round(safeLeft)}px`;
  node.style.top = `${Math.round(safeTop)}px`;
  node.style.width = `${Math.round(safeWidth)}px`;
  node.style.height = `${Math.round(safeHeight)}px`;
  if (mode === 'line') {
    node.style.border = 'none';
    node.style.borderRadius = '9999px';
    node.style.backgroundColor = 'rgba(37, 99, 235, 0.8)';
  } else {
    node.style.border = '2px dashed rgba(37, 99, 235, 0.55)';
    node.style.borderRadius = '12px';
    node.style.backgroundColor = 'rgba(37, 99, 235, 0.12)';
  }
}

function hideDomDropIndicator() {
  if (domDropIndicator) {
    domDropIndicator.style.display = 'none';
  }
}

function removeDropPreviewHost() {
  if (dropPreviewHost && dropPreviewHost.isConnected) {
    dropPreviewHost.remove();
  }
  dropPreviewHost = null;
  dropPreviewSourceId = '';
}

function ensureDropPreviewHost(element) {
  if (dropPreviewHost && dropPreviewSourceId === element.id && dropPreviewHost.isConnected) {
    return dropPreviewHost;
  }
  removeDropPreviewHost();
  if (!element || !element.id) {
    return null;
  }
  const previewElement = {
    ...element,
    id: `${element.id}-preview`,
    containerId: '',
    floating: false,
    style: { ...(element.style || {}) },
  };
  const host = createHost(previewElement);
  host.removeAttribute(HOST_ATTRIBUTE);
  host.dataset.pageAugmentorPreview = 'true';
  host.dataset.previewSourceId = element.id;
  host.style.pointerEvents = 'none';
  dropPreviewHost = host;
  dropPreviewSourceId = element.id;
  return host;
}

function showAreaDropPreview(dropTarget, element) {
  if (!dropTarget?.content) {
    removeDropPreviewHost();
    return;
  }
  const host = ensureDropPreviewHost(element);
  if (!host) {
    return;
  }
  if (host.parentNode !== dropTarget.content) {
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    dropTarget.content.appendChild(host);
  }
  resetHostPosition(host);
}

function showDomDropPreview(placement, element) {
  if (!placement || !(placement.reference instanceof HTMLElement)) {
    removeDropPreviewHost();
    return;
  }
  const host = ensureDropPreviewHost(element);
  if (!host) {
    return;
  }
  if (host.parentNode && host.parentNode !== placement.reference && host.parentNode !== placement.reference.parentElement) {
    host.parentNode.removeChild(host);
  }
  const { reference, position } = placement;
  if (position === 'append') {
    reference.appendChild(host);
  } else if (position === 'prepend') {
    reference.insertBefore(host, reference.firstChild);
  } else if (position === 'before' && reference.parentElement) {
    reference.parentElement.insertBefore(host, reference);
  } else if (position === 'after' && reference.parentElement) {
    reference.parentElement.insertBefore(host, reference.nextSibling);
  } else {
    reference.appendChild(host);
  }
  resetHostPosition(host);
}

function escapeAttributeSelector(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, '\\$&');
}

function findHostByElementId(elementId) {
  if (!elementId) {
    return null;
  }
  const escapedId = escapeAttributeSelector(elementId);
  return document.querySelector(`[${HOST_ATTRIBUTE}="${escapedId}"]`);
}

function flushPendingContainerAttachments() {
  pendingContainerRetryHandle = 0;
  if (pendingContainerAttachments.size === 0) {
    return;
  }
  for (const [elementId, entry] of pendingContainerAttachments) {
    const { host, containerId } = entry;
    if (!(host instanceof HTMLElement) || !containerId) {
      pendingContainerAttachments.delete(elementId);
      continue;
    }
    const areaHost = findHostByElementId(containerId);
    const container = resolveAreaContent(areaHost);
    if (container) {
      container.appendChild(host);
      resetHostPosition(host);
      pendingContainerAttachments.delete(elementId);
    }
  }
  schedulePendingContainerAttachments();
}

function schedulePendingContainerAttachments() {
  if (pendingContainerAttachments.size === 0) {
    if (pendingContainerRetryHandle) {
      clearTimeout(pendingContainerRetryHandle);
      pendingContainerRetryHandle = 0;
    }
    return;
  }
  if (pendingContainerRetryHandle) {
    return;
  }
  pendingContainerRetryHandle = window.setTimeout(flushPendingContainerAttachments, 160);
}

function queuePendingContainerAttachment(host, element) {
  if (!(host instanceof HTMLElement) || !element || !element.id || !element.containerId) {
    return;
  }
  pendingContainerAttachments.set(element.id, {
    host,
    containerId: element.containerId,
  });
  schedulePendingContainerAttachments();
}

export function clearPendingContainerAttachment(elementId) {
  if (!elementId) {
    return;
  }
  pendingContainerAttachments.delete(elementId);
  schedulePendingContainerAttachments();
}

export function createHost(element) {
  const host = document.createElement('span');
  host.className = HOST_CLASS;
  host.setAttribute(HOST_ATTRIBUTE, element.id);
  host.part = 'page-augmentor-host';
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host {
      all: initial;
      display: inline-block;
    }
    .${NODE_CLASS} {
      pointer-events: auto;
      font-family: inherit;
    }
    :host([data-page-augmentor-editing='true']) .${NODE_CLASS} {
      outline: 1px dashed rgba(37, 99, 235, 0.4);
      outline-offset: 2px;
    }
    :host([data-page-augmentor-preview='true']) {
      opacity: 0.65;
    }
    :host([data-page-augmentor-preview='true']) .${NODE_CLASS} {
      pointer-events: none;
    }
    button.${NODE_CLASS} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      background-color: #1b84ff;
      color: #fff;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      text-decoration: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
    }
    button.${NODE_CLASS}:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.18);
    }
    button.${NODE_CLASS}:focus-visible {
      outline: 2px solid #1b84ff;
      outline-offset: 2px;
    }
    a.${NODE_CLASS} {
      color: #2563eb;
      text-decoration: underline;
      cursor: pointer;
    }
    .${NODE_CLASS}[data-node-type='area'] {
      cursor: move;
      touch-action: none;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .${NODE_CLASS}.page-augmentor-area-dragging {
      cursor: grabbing;
      opacity: 0.92;
    }
    .${NODE_CLASS}.page-augmentor-floating-dragging {
      cursor: grabbing;
      opacity: 0.96;
    }
    .${NODE_CLASS}[data-node-type='area'] .page-augmentor-area-header {
      font-weight: 600;
      font-size: 0.95rem;
      color: #1f2937;
    }
    .${NODE_CLASS}[data-node-type='area'] .page-augmentor-area-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .${NODE_CLASS}[data-node-type='area'].page-augmentor-area-drop-target {
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.35);
    }
    .${NODE_CLASS}.tooltip {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      cursor: help;
      font-family: inherit;
    }
    .${NODE_CLASS}.tooltip[data-persistent='true'] {
      cursor: default;
    }
    .${NODE_CLASS}.tooltip:focus {
      outline: none;
    }
    .tooltip-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 9999px;
      background-color: #2563eb;
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.18);
      user-select: none;
    }
    .tooltip-bubble {
      position: absolute;
      z-index: 10;
      max-width: 240px;
      min-width: max-content;
      padding: 0.45rem 0.75rem;
      border-radius: 0.75rem;
      background-color: #111827;
      color: #f8fafc;
      font-size: 0.85rem;
      line-height: 1.4;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
      opacity: 0;
      pointer-events: none;
      transform: var(--tooltip-hidden-transform, translate3d(-50%, 6px, 0));
      transition: opacity 0.16s ease, transform 0.16s ease;
      white-space: pre-wrap;
    }
    .${NODE_CLASS}.tooltip[data-persistent='true'] .tooltip-bubble {
      opacity: 1;
      pointer-events: auto;
      transform: var(--tooltip-visible-transform, translate3d(-50%, 0, 0));
    }
    .${NODE_CLASS}.tooltip[data-persistent='false']:hover .tooltip-bubble,
    .${NODE_CLASS}.tooltip[data-persistent='false']:focus-within .tooltip-bubble {
      opacity: 1;
      pointer-events: auto;
      transform: var(--tooltip-visible-transform, translate3d(-50%, 0, 0));
    }
    .${NODE_CLASS}.tooltip[data-position='top'] .tooltip-bubble {
      bottom: calc(100% + 8px);
      left: 50%;
      --tooltip-hidden-transform: translate3d(-50%, 6px, 0);
      --tooltip-visible-transform: translate3d(-50%, 0, 0);
    }
    .${NODE_CLASS}.tooltip[data-position='bottom'] .tooltip-bubble {
      top: calc(100% + 8px);
      left: 50%;
      --tooltip-hidden-transform: translate3d(-50%, -6px, 0);
      --tooltip-visible-transform: translate3d(-50%, 0, 0);
    }
    .${NODE_CLASS}.tooltip[data-position='left'] .tooltip-bubble {
      right: calc(100% + 8px);
      top: 50%;
      --tooltip-hidden-transform: translate3d(6px, -50%, 0);
      --tooltip-visible-transform: translate3d(0, -50%, 0);
    }
    .${NODE_CLASS}.tooltip[data-position='right'] .tooltip-bubble {
      left: calc(100% + 8px);
      top: 50%;
      --tooltip-hidden-transform: translate3d(-6px, -50%, 0);
      --tooltip-visible-transform: translate3d(0, -50%, 0);
    }
    .flash-outline {
      animation: flash-outline 1.1s ease-out forwards;
    }
    @keyframes flash-outline {
      0% {
        box-shadow: 0 0 0 0 rgba(27, 132, 255, 0.7);
      }
      100% {
        box-shadow: 0 0 0 12px rgba(27, 132, 255, 0);
      }
    }
  `;
  shadowRoot.appendChild(style);
  const node = createNodeForType(element.type);
  shadowRoot.appendChild(node);
  hydrateNode(node, element);
  const styleTarget = getStyleTarget(node);
  applyStyle(styleTarget, element.style);
  return host;
}

export function applyMetadata(host, element) {
  const shadow = host.shadowRoot;
  if (!shadow) {
    return;
  }
  let node = shadow.querySelector(`.${NODE_CLASS}`);
  if (!(node instanceof HTMLElement) || node.dataset.nodeType !== element.type) {
    const replacement = createNodeForType(element.type);
    if (node) {
      shadow.replaceChild(replacement, node);
    } else {
      shadow.appendChild(replacement);
    }
    node = replacement;
  }
  hydrateNode(node, element);
  const styleTarget = getStyleTarget(node);
  applyStyle(styleTarget, element.style);
}

export function insertHost(host, element) {
  const target = resolveSelector(element.selector);
  if (element.type === 'area') {
    document.body.appendChild(host);
    positionFloatingHost(host, element, target);
    schedulePendingContainerAttachments();
    return true;
  }
  if (element.containerId) {
    const parent = findHostByElementId(element.containerId);
    const container = resolveAreaContent(parent);
    if (container) {
      container.appendChild(host);
      resetHostPosition(host);
      return true;
    }
    queuePendingContainerAttachment(host, element);
    return true;
  }
  if (element.floating) {
    document.body.appendChild(host);
    positionFloatingHost(host, element, target);
    return true;
  }
  if (!target) {
    return false;
  }
  switch (element.position) {
    case 'append':
      target.appendChild(host);
      break;
    case 'prepend':
      target.insertBefore(host, target.firstChild);
      break;
    case 'before':
      if (!target.parentElement) {
        return false;
      }
      target.parentElement.insertBefore(host, target);
      break;
    case 'after':
      if (!target.parentElement) {
        return false;
      }
      target.parentElement.insertBefore(host, target.nextSibling);
      break;
    default:
      target.appendChild(host);
  }
  return true;
}

export function flashHighlight(host) {
  const shadow = host.shadowRoot;
  if (!shadow) {
    return;
  }
  const node = shadow.querySelector(`.${NODE_CLASS}`);
  if (!node) {
    return;
  }
  node.classList.remove('flash-outline');
  void node.offsetWidth; // force reflow
  node.classList.add('flash-outline');
}

function createNodeForType(type) {
  if (type === 'link') {
    return document.createElement('a');
  }
  if (type === 'tooltip') {
    return createTooltipNode();
  }
  if (type === 'area') {
    const wrapper = document.createElement('div');
    const header = document.createElement('div');
    header.className = 'page-augmentor-area-header';
    const content = document.createElement('div');
    content.className = 'page-augmentor-area-content';
    wrapper.append(header, content);
    return wrapper;
  }
  const button = document.createElement('button');
  button.type = 'button';
  return button;
}

function hydrateNode(node, element) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  if (element.type === 'link' && node instanceof HTMLAnchorElement) {
    applyBaseAppearance(node, 'link');
    node.textContent = element.text;
    const sanitized = sanitizeUrl(element.href || '');
    if (sanitized) {
      node.setAttribute('href', sanitized);
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    } else {
      node.removeAttribute('href');
    }
    delete node.dataset.href;
    delete node.dataset.actionSelector;
    node.onclick = null;
    node.removeAttribute('aria-describedby');
    attachFloatingDragBehavior(node, element);
  } else if (element.type === 'button' && node instanceof HTMLButtonElement) {
    applyBaseAppearance(node, 'button');
    node.textContent = element.text;
    applyButtonBehavior(node, element.href, element.actionSelector, element.actionFlow);
    attachFloatingDragBehavior(node, element);
  } else if (element.type === 'tooltip') {
    applyTooltipAppearance(node);
    const bubble = node.querySelector('.tooltip-bubble');
    if (bubble instanceof HTMLElement) {
      bubble.textContent = element.text || '';
      bubble.setAttribute('role', 'tooltip');
      const bubbleId = `page-augmentor-tooltip-${element.id}`;
      bubble.id = bubbleId;
      node.setAttribute('aria-describedby', bubbleId);
    }
    const trigger = node.querySelector('.tooltip-trigger');
    if (trigger instanceof HTMLElement) {
      trigger.textContent = 'i';
      trigger.setAttribute('aria-hidden', 'true');
    }
    const normalizedPosition = normalizeTooltipPosition(element.tooltipPosition);
    configureTooltipPosition(node, bubble, normalizedPosition);
    const persistent = element.tooltipPersistent ? 'true' : 'false';
    node.dataset.persistent = persistent;
    node.setAttribute('data-persistent', persistent);
    node.setAttribute('role', 'group');
    node.tabIndex = 0;
    node.setAttribute('aria-label', element.text || 'tooltip');
    bindTooltipViewportGuards(node);
    attachFloatingDragBehavior(node, element);
  } else if (element.type === 'area') {
    applyBaseAppearance(node, 'area');
    delete node.dataset.href;
    delete node.dataset.actionSelector;
    node.onclick = null;
    node.style.pointerEvents = 'auto';
    node.style.touchAction = 'none';
    attachAreaDragBehavior(node, element);
    node.dataset.areaId = element.id;
    const header = node.querySelector('.page-augmentor-area-header');
    if (header instanceof HTMLElement) {
      const textValue = element.text || '';
      header.textContent = textValue;
      header.style.display = textValue ? 'block' : 'none';
    }
    const content = node.querySelector('.page-augmentor-area-content');
    if (content instanceof HTMLElement) {
      content.dataset.areaContent = element.id;
    }
    const hostElement = getHostFromNode(node);
    if (hostElement) {
      positionFloatingHost(hostElement, element, resolveSelector(element.selector));
    }
    schedulePendingContainerAttachments();
  }
}

function applyButtonBehavior(node, href, actionSelector, actionFlow) {
  if (!(node instanceof HTMLButtonElement)) {
    return;
  }
  const sanitized = sanitizeUrl(href || '');
  const selector = typeof actionSelector === 'string' ? actionSelector.trim() : '';
  const flowSource = typeof actionFlow === 'string' ? actionFlow.trim() : '';
  let parsedFlow = null;
  if (flowSource) {
    const { definition, error } = parseActionFlowDefinition(flowSource);
    if (error) {
      console.warn('[PageAugmentor] Ignoring invalid action flow:', error);
    } else if (definition) {
      parsedFlow = definition;
      if (selector) {
        parsedFlow = {
          steps: [...definition.steps, { type: 'click', selector, all: false }],
          stepCount: definition.stepCount + 1,
        };
      }
    }
  }
  if (sanitized) {
    node.dataset.href = sanitized;
  } else {
    delete node.dataset.href;
  }
  if (selector) {
    node.dataset.actionSelector = selector;
  } else {
    delete node.dataset.actionSelector;
  }
  if (parsedFlow) {
    node.dataset.actionFlow = String(parsedFlow.stepCount);
  } else {
    delete node.dataset.actionFlow;
  }
  if (!parsedFlow && !selector && !sanitized) {
    node.onclick = null;
    return;
  }
  node.onclick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    let handled = false;
    if (parsedFlow) {
      try {
        handled = await executeActionFlow(node, parsedFlow);
      } catch (error) {
        console.error('[PageAugmentor] Failed to execute flow', error);
      }
    }
    if (handled) {
      return;
    }
    if (selector) {
      const target = resolveSelector(selector);
      if (target) {
        const triggered = forwardClick(target);
        if (!triggered) {
          if (sanitized) {
            window.open(sanitized, '_blank', 'noopener');
          } else if (typeof target.click === 'function') {
            try {
              target.click();
            } catch (clickError) {
              console.warn('[PageAugmentor] Native click fallback failed', clickError);
            }
          }
        }
        return;
      }
    }
    if (sanitized) {
      window.open(sanitized, '_blank', 'noopener');
    }
  };
}


function getHostFromNode(node) {
  const root = node.getRootNode();
  if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
    return root.host;
  }
  return null;
}

function resolveAreaContent(host) {
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

function resetHostPosition(host) {
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

function findAreaDropTarget(clientX, clientY, excludeId) {
  const hosts = document.querySelectorAll(`[${HOST_ATTRIBUTE}]`);
  for (const host of hosts) {
    if (!(host instanceof HTMLElement)) {
      continue;
    }
    const elementId = host.getAttribute(HOST_ATTRIBUTE);
    if (!elementId || elementId === excludeId) {
      continue;
    }
    const shadow = host.shadowRoot;
    if (!shadow) {
      continue;
    }
    const areaNode = shadow.querySelector(`.${NODE_CLASS}[data-node-type='area']`);
    if (!(areaNode instanceof HTMLElement)) {
      continue;
    }
    const rect = areaNode.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      const content = areaNode.querySelector('.page-augmentor-area-content');
      return {
        id: elementId,
        host,
        areaNode,
        content: content instanceof HTMLElement ? content : areaNode,
      };
    }
  }
  return null;
}

function isVoidElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  return VOID_ELEMENT_TAGS.has(element.tagName);
}

function findDomDropTarget(clientX, clientY, draggedHost) {
  if (draggedHost instanceof HTMLElement) {
    const previous = draggedHost.style.pointerEvents;
    draggedHost.style.pointerEvents = 'none';
    try {
      const candidates = document.elementsFromPoint(clientX, clientY);
      for (const candidate of candidates) {
        if (!(candidate instanceof HTMLElement)) {
          continue;
        }
        if (candidate === draggedHost || draggedHost.contains(candidate)) {
          continue;
        }
        if (candidate.closest(`[${HOST_ATTRIBUTE}]`)) {
          continue;
        }
        if (candidate.closest(AUGMENTOR_ROOT_SELECTOR)) {
          continue;
        }
        return candidate;
      }
    } finally {
      draggedHost.style.pointerEvents = previous || '';
    }
    return null;
  }
  const candidates = document.elementsFromPoint(clientX, clientY);
  for (const candidate of candidates) {
    if (
      candidate instanceof HTMLElement &&
      !candidate.closest(`[${HOST_ATTRIBUTE}]`) &&
      !candidate.closest(AUGMENTOR_ROOT_SELECTOR)
    ) {
      return candidate;
    }
  }
  return null;
}

function resolveDomDropPlacement(target, clientX, clientY) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  if (target.closest(`[${HOST_ATTRIBUTE}]`)) {
    return null;
  }
  if (target === document.documentElement) {
    const body = document.body;
    if (!(body instanceof HTMLElement)) {
      return null;
    }
    const bodyRect = body.getBoundingClientRect();
    return {
      reference: body,
      selector: 'body',
      position: 'append',
      indicator: {
        mode: 'box',
        top: bodyRect.top,
        left: bodyRect.left,
        width: bodyRect.width,
        height: bodyRect.height,
      },
    };
  }
  const rect = target.getBoundingClientRect();
  const height = rect.height || 1;
  const relY = (clientY - rect.top) / height;

  let selector;
  try {
    selector = generateSelector(target);
  } catch (_error) {
    selector = '';
  }
  if (!selector) {
    return null;
  }

  if (isVoidElement(target) || !target.parentElement) {
    const position = relY < 0.5 ? 'before' : 'after';
    const lineTop = position === 'before' ? rect.top : rect.bottom;
    return {
      reference: target,
      selector,
      position,
      indicator: {
        mode: 'line',
        top: lineTop - 2,
        left: rect.left,
        width: rect.width,
        height: 4,
      },
    };
  }

  if (relY < 0.25) {
    return {
      reference: target,
      selector,
      position: 'prepend',
      indicator: {
        mode: 'box',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  if (relY > 0.75) {
    return {
      reference: target,
      selector,
      position: 'append',
      indicator: {
        mode: 'box',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    };
  }

  return {
    reference: target,
    selector,
    position: 'append',
    indicator: {
      mode: 'box',
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
  };
}

function dispatchDraftUpdateFromHost(host, detail) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const elementId = host.getAttribute(HOST_ATTRIBUTE);
  const payload = {
    ...(detail || {}),
  };
  if (!payload.elementId && elementId) {
    payload.elementId = elementId;
  }
  host.dispatchEvent(
    new CustomEvent('page-augmentor-draft-update', {
      detail: payload,
      bubbles: true,
      composed: true,
    }),
  );
}

function positionFloatingHost(host, element, target) {
  if (!(host instanceof HTMLElement)) {
    return;
  }
  const style = element?.style || {};
  const hasAbsolute = typeof style.position === 'string' && style.position.trim().toLowerCase() === 'absolute';
  const left = typeof style.left === 'string' ? style.left.trim() : '';
  const top = typeof style.top === 'string' ? style.top.trim() : '';

  host.style.position = 'absolute';
  host.style.zIndex = typeof style.zIndex === 'string' && style.zIndex.trim() ? style.zIndex : '1000';
  host.style.width = '';
  host.style.height = '';

  if (hasAbsolute && left && top) {
    host.style.left = left;
    host.style.top = top;
    return;
  }

  const reference = target instanceof Element ? target.getBoundingClientRect() : null;
  if (reference) {
    host.style.left = `${reference.left + window.scrollX + 16}px`;
    host.style.top = `${reference.top + window.scrollY + 16}px`;
  } else {
    host.style.left = `${window.scrollX + 120}px`;
    host.style.top = `${window.scrollY + 120}px`;
  }
}

function attachAreaDragBehavior(node, element) {
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
  let startRect = null;

  const handleMove = (event) => {
    if (!dragging || pointerId !== event.pointerId) {
      return;
    }
    const host = getHostFromNode(node);
    if (!host) {
      return;
    }
    const nextLeft = originLeft + (event.clientX - startX);
    const nextTop = originTop + (event.clientY - startY);
    host.style.left = `${Math.round(nextLeft)}px`;
    host.style.top = `${Math.round(nextTop)}px`;
  };

  const finalizeDrag = async () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    pointerId = null;
    node.classList.remove('page-augmentor-area-dragging');
    node.style.userSelect = '';
    const host = getHostFromNode(node);
    if (!host) {
      return;
    }
    host.style.width = '';
    host.style.height = '';
    const rect = host.getBoundingClientRect();
    const style = {
      ...(element.style || {}),
      position: 'absolute',
      left: `${Math.round(rect.left + window.scrollX)}px`,
      top: `${Math.round(rect.top + window.scrollY)}px`,
    };
    element.style = style;
    dispatchDraftUpdateFromHost(host, {
      elementId: element.id,
      style: {
        position: style.position,
        left: style.left,
        top: style.top,
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
    if (!host || host.dataset.pageAugmentorEditing !== 'true') {
      return;
    }
    dispatchDraftUpdateFromHost(host, { bubbleSide: 'left' });
    dragging = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    const rect = host.getBoundingClientRect();
    originLeft = rect.left + window.scrollX;
    originTop = rect.top + window.scrollY;
    startRect = rect;
    host.style.width = `${rect.width}px`;
    host.style.height = `${rect.height}px`;
    host.style.position = 'absolute';
    host.style.left = `${Math.round(originLeft)}px`;
    host.style.top = `${Math.round(originTop)}px`;
    host.style.zIndex = element.style?.zIndex && element.style.zIndex.trim() ? element.style.zIndex : '2147482000';
    if (host.parentElement !== document.body) {
      document.body.appendChild(host);
    }
    node.classList.add('page-augmentor-area-dragging');
    node.style.userSelect = 'none';
    try {
      node.setPointerCapture(pointerId);
    } catch (_error) {
      // ignore pointer capture issues
    }
    event.preventDefault();
  });

  node.addEventListener('pointermove', handleMove);
  node.addEventListener('pointerup', (event) => {
    if (event.pointerId === pointerId) {
      try {
        node.releasePointerCapture(pointerId);
      } catch (_error) {
        // ignore release issues
      }
      finalizeDrag();
    }
  });
  node.addEventListener('pointercancel', () => {
    finalizeDrag();
  });
}

function attachFloatingDragBehavior(node, element) {
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
  let currentDropTarget = /** @type {null | { kind: 'area'; area: ReturnType<typeof findAreaDropTarget> } | { kind: 'dom'; placement: ReturnType<typeof resolveDomDropPlacement> }} */ (
    null
  );
  let highlightedArea = null;
  let startRect = null;

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

  const startDragging = () => {
    if (dragStarted) {
      return;
    }
    const host = getHostFromNode(node);
    if (!host) {
      return;
    }
    dragStarted = true;
    if (startRect) {
      host.style.width = `${startRect.width}px`;
      host.style.height = `${startRect.height}px`;
    }
    host.style.position = 'absolute';
    host.style.left = `${Math.round(originLeft)}px`;
    host.style.top = `${Math.round(originTop)}px`;
    host.style.zIndex = originalStyle.zIndex && originalStyle.zIndex.trim() ? originalStyle.zIndex : '2147482000';
    if (host.parentElement !== document.body) {
      document.body.appendChild(host);
    }
    node.classList.add('page-augmentor-floating-dragging');
    node.style.userSelect = 'none';
    currentDropTarget = null;
    highlightedArea = null;
    hideDomDropIndicator();
    removeDropPreviewHost();
    if (pointerId !== null) {
      try {
        node.setPointerCapture(pointerId);
      } catch (_error) {
        // ignore capture issues
      }
    }
  };

  const finalizeDrag = (commit) => {
    const host = getHostFromNode(node);
    if (!host) {
      return;
    }
    if (pointerId !== null) {
      try {
        node.releasePointerCapture(pointerId);
      } catch (_error) {
        // ignore release failures
      }
    }
    pointerId = null;
    dragging = false;
    dragStarted = false;
    startRect = null;
    node.classList.remove('page-augmentor-floating-dragging');
    node.style.userSelect = '';
    updateHighlight(null);
    hideDomDropIndicator();
    removeDropPreviewHost();
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
      element.floating = originalFloating;
      if (originalContainerId) {
        element.containerId = originalContainerId;
      } else {
        delete element.containerId;
      }
      element.style = { ...originalStyle };
      if (originalFloating) {
        host.style.position = 'absolute';
        host.style.left = originalStyle.left || '';
        host.style.top = originalStyle.top || '';
        host.style.zIndex = originalStyle.zIndex || '';
      } else {
        resetHostPosition(host);
      }
      dispatchDraftUpdateFromHost(host, {
        elementId: element.id,
        style: {
          position: originalStyle.position || '',
          left: originalStyle.left || '',
          top: originalStyle.top || '',
          zIndex: originalStyle.zIndex || '',
        },
        containerId: originalContainerId,
        floating: originalFloating,
        bubbleSide: 'right',
      });
      return;
    }

    const dropTarget = currentDropTarget;
    currentDropTarget = null;
    if (dropTarget && dropTarget.kind === 'area' && dropTarget.area?.content) {
      dropTarget.area.content.appendChild(host);
      resetHostPosition(host);
      element.floating = false;
      element.containerId = dropTarget.area.id;
      const nextStyle = { ...(element.style || {}) };
      nextStyle.position = '';
      nextStyle.left = '';
      nextStyle.top = '';
      element.style = nextStyle;
      clearPendingContainerAttachment(element.id);
      dispatchDraftUpdateFromHost(host, {
        elementId: element.id,
        style: {
          position: '',
          left: '',
          top: '',
        },
        containerId: dropTarget.area.id,
        floating: false,
        bubbleSide: 'right',
      });
      return;
    }

    if (dropTarget && dropTarget.kind === 'dom' && dropTarget.placement) {
      let reference = dropTarget.placement.reference;
      const selector = dropTarget.placement.selector;
      const position = dropTarget.placement.position;
      if (!(reference instanceof HTMLElement) || !reference.isConnected) {
        const fallback = typeof selector === 'string' ? resolveSelector(selector) : null;
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
        resetHostPosition(host);
        element.floating = false;
        delete element.containerId;
        element.selector = selector;
        element.position = position;
        const nextStyle = { ...(element.style || {}) };
        nextStyle.position = '';
        nextStyle.left = '';
        nextStyle.top = '';
        nextStyle.zIndex = '';
        element.style = nextStyle;
        clearPendingContainerAttachment(element.id);
        dispatchDraftUpdateFromHost(host, {
          elementId: element.id,
          selector,
          position,
          style: {
            position: '',
            left: '',
            top: '',
            zIndex: '',
          },
          containerId: '',
          floating: false,
          bubbleSide: 'right',
        });
        return;
      }
    }

    document.body.appendChild(host);
    const rect = host.getBoundingClientRect();
    const left = Math.round(rect.left + window.scrollX);
    const top = Math.round(rect.top + window.scrollY);
    host.style.position = 'absolute';
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
    const nextStyle = { ...(element.style || {}) };
    nextStyle.position = 'absolute';
    nextStyle.left = `${left}px`;
    nextStyle.top = `${top}px`;
    nextStyle.zIndex = nextStyle.zIndex && nextStyle.zIndex.trim() ? nextStyle.zIndex : '2147482000';
    element.style = nextStyle;
    element.floating = true;
    delete element.containerId;
    clearPendingContainerAttachment(element.id);
    dispatchDraftUpdateFromHost(host, {
      elementId: element.id,
      style: {
        position: 'absolute',
        left: nextStyle.left,
        top: nextStyle.top,
        zIndex: nextStyle.zIndex || '',
      },
      containerId: '',
      floating: true,
      bubbleSide: 'right',
    });
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
    const nextLeft = originLeft + (event.clientX - startX);
    const nextTop = originTop + (event.clientY - startY);
    host.style.left = `${Math.round(nextLeft)}px`;
    host.style.top = `${Math.round(nextTop)}px`;
    const areaDropTarget = findAreaDropTarget(event.clientX, event.clientY, element.id);
    if (areaDropTarget) {
      currentDropTarget = { kind: 'area', area: areaDropTarget };
      updateHighlight(areaDropTarget);
      showAreaDropPreview(areaDropTarget, element);
      hideDomDropIndicator();
      return;
    }
    updateHighlight(null);
    removeDropPreviewHost();
    const domTarget = findDomDropTarget(event.clientX, event.clientY, host);
    if (domTarget instanceof HTMLElement) {
      const placement = resolveDomDropPlacement(domTarget, event.clientX, event.clientY);
      if (placement) {
        currentDropTarget = { kind: 'dom', placement };
        showDomDropPreview(placement, element);
        showDomDropIndicator(placement.indicator);
        return;
      }
    }
    currentDropTarget = null;
    hideDomDropIndicator();
    removeDropPreviewHost();
  };

  node.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== -1) {
      return;
    }
    const host = getHostFromNode(node);
    if (!host || host.dataset.pageAugmentorEditing !== 'true') {
      return;
    }
    dispatchDraftUpdateFromHost(host, { bubbleSide: 'left' });
    dragging = true;
    dragStarted = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    const rect = host.getBoundingClientRect();
    originLeft = rect.left + window.scrollX;
    originTop = rect.top + window.scrollY;
    originalContainerId = typeof element.containerId === 'string' ? element.containerId : '';
    originalFloating = element.floating !== false;
    originalStyle = { ...(element.style || {}) };
    originalParent = host.parentNode;
    originalNextSibling = host.nextSibling;
    currentDropTarget = null;
    highlightedArea = null;
    startRect = rect;
    hideDomDropIndicator();
    removeDropPreviewHost();
    const isGlobalEditing = host.dataset.pageAugmentorGlobalEditing === 'true';
    if (!isGlobalEditing) {
      startDragging();
      event.preventDefault();
    }
  });

  node.addEventListener('pointermove', handleMove);
  node.addEventListener('pointerup', (event) => {
    if (event.pointerId === pointerId) {
      finalizeDrag(dragStarted);
    }
  });
  node.addEventListener('pointercancel', () => {
    finalizeDrag(false);
  });
}
