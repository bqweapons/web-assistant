import { createHost } from '../host/create-host.js';
import { parseActionFlowDefinition } from '../../../common/flows.js';
/**
 * @typedef {import('../../../common/types.js').InjectedElement} InjectedElement
 */
/**
 * @typedef {import('../../../common/types.js').DragDeps} DragDeps
 */
import { HOST_ATTRIBUTE, HOST_CLASS, NODE_CLASS } from '../core/constants.js';
import { executeActionFlow } from '../core/flow-runner.js';
import { applyBaseAppearance, applyStyle, getStyleTarget, normalizeTooltipPosition } from '../ui/index.js';
import {
  applyTooltipAppearance,
  configureTooltipPosition,
  createTooltipNode,
  bindTooltipViewportGuards,
} from '../ui/index.js';
import { forwardClick, resolveSelector, sanitizeUrl } from '../core/utils.js';
// Drag core + strategies (barrel)
import {
  isEditingAllowed,
  getHostFromNode,
  getHostRectScreen,
  setHostPosition,
  setPointerCaptureSafe,
  releasePointerCaptureSafe,
  dispatchDraftUpdateFromHost,
  positionFloatingHost,
  attachDragBehavior,
  attachResizeStrategy,
} from '../interactions/drag/index.js';
import { generateSelector } from '../../selector/utils.js';
import {
  showDomDropIndicator,
  hideDomDropIndicator,
  showAreaDropPreview as showAreaDropPreviewRaw,
  showDomDropPreview as showDomDropPreviewRaw,
  removeDropPreviewHost,
  findAreaDropTarget,
  findDomDropTarget,
  resolveDomDropPlacement,
} from '../interactions/drop/index.js';
import { applyButtonBehavior } from '../behaviors/index.js';
import { resolveAreaContent, resetHostPosition } from '../host/index.js';

/** @type {Map<string, { host: HTMLElement; containerId: string }>} */
const pendingContainerAttachments = new Map();
let pendingContainerRetryHandle = 0;

// moved to drop/targets.js (VOID elements), drop/indicator.js, and drop/preview.js

/**
 * Provides drag dependencies to strategies (DI port)
 * @returns {DragDeps}
 */
function getFloatingDragDeps() {
  const showAreaDropPreview = (dropTarget, element) => showAreaDropPreviewRaw(dropTarget, element, createHost);
  const showDomDropPreview = (placement, element) => showDomDropPreviewRaw(placement, element, createHost);
  return {
    findAreaDropTarget,
    showAreaDropPreview,
    hideDomDropIndicator,
    removeDropPreviewHost,
    findDomDropTarget,
    resolveDomDropPlacement,
    showDomDropPreview,
    showDomDropIndicator,
    resetHostPosition,
    clearPendingContainerAttachment,
    resolveSelector,
  };
}


// moved to drop/preview.js (ensure)

// moved to drop/preview.js (area)

// moved to drop/preview.js (dom)

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



//
 moved to host/create-host.js



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
  bindEditingEnhancements(node, element);
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

// Dev-only: simple sanity for drop target placement (tree-shaken in prod)
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
  try {
    // Expose a helper to the page for quick checks
    // Usage in console: window.__PA_sanityTargets()
    window.__PA_sanityTargets = () => {
      const probe = document.createElement('div');
      Object.assign(probe.style, {
        position: 'absolute', left: '200px', top: '200px', width: '100px', height: '100px', background: 'transparent',
      });
      document.body.appendChild(probe);
      const rect = probe.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const nearTop = rect.top + 5;
      const midY = rect.top + rect.height / 2;
      const nearBottom = rect.bottom - 5;
      const pTop = resolveDomDropPlacement(probe, midX, nearTop);
      const pMid = resolveDomDropPlacement(probe, midX, midY);
      const pBot = resolveDomDropPlacement(probe, midX, nearBottom);
      console.log('[PA sanity] top:', pTop?.position, pTop);
      console.log('[PA sanity] mid:', pMid?.position, pMid);
      console.log('[PA sanity] bottom:', pBot?.position, pBot);
      probe.remove();
    };
  } catch (_e) {}
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
    attachDragBehavior(node, element, getFloatingDragDeps());
    bindEditingEnhancements(node, element);
  } else if (element.type === 'button' && node instanceof HTMLButtonElement) {
    applyBaseAppearance(node, 'button');
    node.textContent = element.text;
    applyButtonBehavior(node, element.href, element.actionSelector, element.actionFlow);
    attachDragBehavior(node, element, getFloatingDragDeps());
    bindEditingEnhancements(node, element);
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
    attachDragBehavior(node, element, getFloatingDragDeps());
    bindEditingEnhancements(node, element);
  } else if (element.type === 'area') {
    applyBaseAppearance(node, 'area');
    delete node.dataset.href;
    delete node.dataset.actionSelector;
    node.onclick = null;
    node.style.pointerEvents = 'auto';
    node.style.touchAction = 'none';
    attachDragBehavior(node, element, getFloatingDragDeps());
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
    bindEditingEnhancements(node, element);
  }
}

function bindEditingEnhancements(node, element) {
  if (!(node instanceof HTMLElement) || !element?.id) {
    return;
  }
  if (node.dataset.editEnhanceBound === 'true') {
    return;
  }
  node.dataset.editEnhanceBound = 'true';

  const host = getHostFromNode(node);
  if (!(host instanceof HTMLElement)) {
    return;
  }

  // Inline text editing for simple types
  const resolveEditableNode = () => {
    if (element.type === 'area') {
      const header = node.querySelector('.page-augmentor-area-header');
      return header instanceof HTMLElement ? header : null;
    }
    return node;
  };

  const applyInlineEditingState = () => {
    const editing = host.dataset.pageAugmentorEditing === 'true';
    const editable = resolveEditableNode();
    const isTextual = Boolean(editable) && (element.type === 'button' || element.type === 'link' || element.type === 'area');
    if (isTextual && editable) {
      editable.contentEditable = editing ? 'plaintext-only' : 'false';
      editable.spellcheck = false;
    }
  };

  const handleInlineInput = (event) => {
    const editable = resolveEditableNode();
    if (!editable) return;
    const text = (editable.textContent || '').trim();
    dispatchDraftUpdateFromHost(host, { elementId: element.id, style: {}, bubbleSide: 'left' });
    // Update text via preview patch; the bubble listens and merges style via merge(), text is handled via preview
    try {
      host.dispatchEvent(
        new CustomEvent('page-augmentor-draft-update', {
          detail: { elementId: element.id, text, bubbleSide: 'left' },
          bubbles: true,
          composed: true,
        }),
      );
    } catch (_e) {}
  };

  // Resize behavior
  attachResizeStrategy(node, element, host);

  // Watch editing attribute to toggle inline edit + handles visibility
  const observer = new MutationObserver(() => applyInlineEditingState());
  observer.observe(host, { attributes: true, attributeFilter: ['data-page-augmentor-editing'] });
  applyInlineEditingState();

  const editable = resolveEditableNode();
  if (editable) {
    editable.addEventListener('input', handleInlineInput);
    editable.addEventListener('blur', handleInlineInput);
  }
}

// moved to ./behaviors/button.js: applyButtonBehavior


// moved to ./drag/core.js: getHostFromNode

// moved to ./host/utils.js: resolveAreaContent, resetHostPosition

// moved to drop/targets.js: findAreaDropTarget

// moved to drop/targets.js: isVoidElement

// moved to drop/targets.js: findDomDropTarget

// moved to drop/targets.js: resolveDomDropPlacement

// moved to ./drag/core.js: dispatchDraftUpdateFromHost

// moved to ./drag/core.js: positionFloatingHost




















