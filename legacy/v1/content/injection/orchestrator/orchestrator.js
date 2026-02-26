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
import { dispatchUiUpdateFromHost } from '../interactions/drag/core.js';
import { resolveAreaContent, resetHostPosition } from '../host/index.js';

/** @type {Map<string, { host: HTMLElement; containerId: string }>} */
const pendingContainerAttachments = new Map();
let pendingContainerRetryHandle = 0;

// moved to drop/targets.js (VOID elements), drop/indicator.js, and drop/preview.js

/**
 * ドラッグ挙動の各戦略へ依存関係を供給する。
 * Provides drag dependencies to strategies (DI port).
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

/**
 * 属性セレクターに埋め込む値をエスケープする。
 * Escapes a value for safe attribute selector usage.
 * @param {string} value
 * @returns {string}
 */
function escapeAttributeSelector(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, '\\$&');
}

/**
 * 要素 ID から既存ホストを検索する。
 * Finds an existing host node by element ID.
 * @param {string} elementId
 * @returns {Element | null}
 */
function findHostByElementId(elementId) {
  if (!elementId) {
    return null;
  }
  const escapedId = escapeAttributeSelector(elementId);
  return document.querySelector(`[${HOST_ATTRIBUTE}="${escapedId}"]`);
}

/**
 * Creates a shallow, per-interaction copy of an injected element so that
 * drag/resize handlers don't mutate the registry object by reference.
 * @param {import('../../../common/types.js').InjectedElement} element
 */
// NOTE: Interactions should treat the element object as immutable during a user
// gesture. Drag/resize handlers must not mutate it directly; instead they
// should dispatch 'page-augmentor-draft-update' with the intended changes.

/**
 * 保留中のコンテナ割り当てを即時処理する。
 * Flushes queued container attachments immediately.
 */
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

/**
 * 保留中のコンテナ割り当て処理をスケジュールする。
 * Schedules pending container attachment retries.
 */
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

/**
 * エリア型要素のコンテナへの挿入を保留キューに追加する。
 * Queues a pending container attachment for area elements.
 * @param {HTMLElement} host
 * @param {import('../../../common/types.js').InjectedElement} element
 */
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

/**
 * 保留中のコンテナ割り当てをキャンセルする。
 * Clears a pending container attachment for an element ID.
 * @param {string} elementId
 */
export function clearPendingContainerAttachment(elementId) {
  if (!elementId) {
    return;
  }
  pendingContainerAttachments.delete(elementId);
  schedulePendingContainerAttachments();
}



// moved to host/create-host.js



/**
 * ホストの Shadow DOM を要素メタデータで初期化する。
 * Applies metadata into the host's shadow DOM content.
 * @param {HTMLElement} host
 * @param {import('../../../common/types.js').InjectedElement} element
 */
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

/**
 * ホスト要素をコンテナや対象ノードへ挿入する。
 * Inserts the host into the DOM according to element positioning.
 * @param {HTMLElement} host
 * @param {import('../../../common/types.js').InjectedElement} element
 * @returns {boolean}
 */
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

/**
 * 一時的にアウトラインを点滅させてホストを強調表示する。
 * Flashes a highlight outline on the host.
 * @param {HTMLElement} host
 */
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
      probe.remove();
    };
  } catch (_e) {}
}

/**
 * 要素タイプに応じた Shadow DOM ノードを生成する。
 * Creates a shadow node that matches the element type.
 * @param {import('../../../common/types.js').InjectedElement['type']} type
 * @returns {HTMLElement}
 */
function createNodeForType(type) {
  if (type === 'link') {
    return document.createElement('a');
  }
  if (type === 'tooltip') {
    return createTooltipNode();
  }
  if (type === 'area') {
    const wrapper = document.createElement('div');
    const content = document.createElement('div');
    content.className = 'page-augmentor-area-content';
    wrapper.append(content);
    return wrapper;
  }
  const button = document.createElement('button');
  button.type = 'button';
  return button;
}

/**
 * Shadow DOM ノードへ注入要素の内容・属性を反映する。
 * Hydrates the shadow node with element data and behaviours.
 * @param {HTMLElement} node
 * @param {import('../../../common/types.js').InjectedElement} element
 */
function hydrateNode(node, element) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const preserveResizeHandlesDuring = (target, mutator) => {
    try {
      const handles = Array.from(target.querySelectorAll('.page-augmentor-resize-handle'));
      // Temporarily detach handles to avoid being wiped by textContent updates
      handles.forEach((h) => h.parentElement === target && h.remove());
      try {
        mutator();
      } finally {
        // Re-attach in original order
        handles.forEach((h) => target.appendChild(h));
      }
    } catch (_e) {
      // Fallback to plain mutation if anything goes wrong
      try {
        mutator();
      } catch (_ignored) {}
    }
  };
  if (element.type === 'link' && node instanceof HTMLAnchorElement) {
    applyBaseAppearance(node, 'link');
    preserveResizeHandlesDuring(node, () => {
      node.textContent = element.text;
    });
    const sanitized = sanitizeUrl(element.href || '');
    if (sanitized) {
      node.setAttribute('href', sanitized);
      node.setAttribute('rel', 'noopener noreferrer');
      const targetMode = element.linkTarget === 'same-tab' ? 'same-tab' : 'new-tab';
      const domTarget = targetMode === 'same-tab' ? '_self' : '_blank';
      node.setAttribute('target', domTarget);
    } else {
      node.removeAttribute('href');
      node.removeAttribute('target');
    }
    delete node.dataset.href;
    delete node.dataset.actionSelector;
    if (sanitized && element.linkTarget === 'same-tab') {
      node.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          window.location.replace(element.href);
        } catch (_e) {
          try {
            window.location.assign(sanitized);
          } catch (__e) {}
        }
      };
    } else {
      node.onclick = null;
    }
    node.removeAttribute('aria-describedby');
    attachDragBehavior(node, element, getFloatingDragDeps());
    bindEditingEnhancements(node, element);
  } else if (element.type === 'button' && node instanceof HTMLButtonElement) {
    applyBaseAppearance(node, 'button');
    preserveResizeHandlesDuring(node, () => {
      node.textContent = element.text;
    });
    applyButtonBehavior(
      node,
      element.href,
      element.actionSelector,
      element.actionFlow,
      element.actionFlowId,
      element.id,
    );
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
    const normalizedPosition = normalizeTooltipPosition(element.tooltipPosition);
    configureTooltipPosition(node, bubble, normalizedPosition);
    const persistent = element.tooltipPersistent ? 'true' : 'false';
    node.dataset.persistent = persistent;
    node.setAttribute('data-persistent', persistent);
    node.setAttribute('role', 'group');
    node.tabIndex = 0;
    node.setAttribute('aria-label', element.text || 'tooltip');
    bindTooltipViewportGuards(node);
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
    const content = node.querySelector('.page-augmentor-area-content');
    if (content instanceof HTMLElement) {
      content.dataset.areaContent = element.id;
      const layout = element.layout === 'column' ? 'column' : 'row';
      content.style.display = 'flex';
      content.style.flexDirection = layout;
      content.style.flexWrap = layout === 'row' ? 'wrap' : 'nowrap';
      content.style.alignItems = 'flex-start';
    }
    const hostElement = getHostFromNode(node);
    if (hostElement) {
      positionFloatingHost(hostElement, element, resolveSelector(element.selector));
    }
    schedulePendingContainerAttachments();
    bindEditingEnhancements(node, element);
  }
}

/**
 * 編集モード用のイベントや MutationObserver を結び付ける。
 * Binds editing enhancements like inline editing and resize handles.
 * @param {HTMLElement} node
 * @param {import('../../../common/types.js').InjectedElement} element
 */
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
      return null;
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
    // UI-only hint to move the editor bubble to the left while typing
    dispatchUiUpdateFromHost(host, { elementId: element.id, bubbleSide: 'left' });
    dispatchDraftUpdateFromHost(host, { elementId: element.id });
    // Update text via preview patch; the bubble listens and merges style via merge(), text is handled via preview
    try {
      // Persist text via draft; keep bubble-side as a separate UI update
      host.dispatchEvent(
        new CustomEvent('page-augmentor-draft-update', {
          detail: { elementId: element.id, text },
          bubbles: true,
          composed: true,
        }),
      );
      host.dispatchEvent(
        new CustomEvent('page-augmentor-ui-update', {
          detail: { elementId: element.id, bubbleSide: 'left' },
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

















