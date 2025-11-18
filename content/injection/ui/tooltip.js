import { NODE_CLASS, TOOLTIP_POSITIONS } from '../core/constants.js';
import { normalizeTooltipPosition } from '../ui/style.js';

/**
 * Creates a fresh tooltip container element and applies base appearance.
 * @returns {HTMLDivElement}
 */
export function createTooltipNode() {
  const container = document.createElement('div');
  applyTooltipAppearance(container);
  return container;
}

/**
 * Applies base tooltip appearance to the given node.
 * Ensures structural children (bubble) exist and data attributes are normalised.
 * @param {HTMLElement} node
 */
export function applyTooltipAppearance(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  node.className = `${NODE_CLASS} tooltip`;
  node.dataset.nodeType = 'tooltip';

  const position = node.dataset.position || '';
  if (!TOOLTIP_POSITIONS.has(position)) {
    node.dataset.position = 'top';
  }

  const persistent = node.dataset.persistent;
  if (persistent !== 'true' && persistent !== 'false') {
    node.dataset.persistent = 'false';
  }

  node.setAttribute('data-position', node.dataset.position);
  node.setAttribute('data-persistent', node.dataset.persistent);
  node.setAttribute('role', 'group');
  node.tabIndex = 0;

  // Ensure trigger icon exists for hover/focus target
  let trigger = node.querySelector('.tooltip-trigger');
  if (!(trigger instanceof HTMLElement)) {
    trigger = document.createElement('span');
    trigger.className = 'tooltip-trigger';
    node.insertBefore(trigger, node.firstChild);
  }
  trigger.textContent = 'i';
  trigger.setAttribute('aria-hidden', 'true');

  let bubble = node.querySelector('.tooltip-bubble');
  if (!(bubble instanceof HTMLElement)) {
    bubble = document.createElement('div');
    bubble.className = 'tooltip-bubble';
    node.appendChild(bubble);
  }
  bubble.setAttribute('role', 'tooltip');
}

// Active tooltip containers participating in viewport guards.
const activeTooltipContainers = new Set();
let tooltipGuardsBound = false;

/**
 * Updates container/bubble position attributes and clears inline offsets.
 * @param {HTMLElement} container
 * @param {HTMLElement | null} bubble
 * @param {string | undefined} position
 */
export function configureTooltipPosition(container, bubble, position) {
  const normalized = normalizeTooltipPosition(position);
  container.dataset.position = normalized;
  container.setAttribute('data-position', normalized);
  if (bubble instanceof HTMLElement) {
    bubble.style.top = '';
    bubble.style.bottom = '';
    bubble.style.left = '';
    bubble.style.right = '';
    bubble.style.removeProperty('--tooltip-hidden-transform');
    bubble.style.removeProperty('--tooltip-visible-transform');
  }
}

/**
 * Binds viewport guards for a tooltip container (scroll/resize + hover).
 * @param {HTMLElement} container
 */
export function bindTooltipViewportGuards(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (container.dataset.tooltipGuard === 'true') {
    return;
  }
  container.dataset.tooltipGuard = 'true';

  activeTooltipContainers.add(container);
  ensureGlobalTooltipGuards();

  const schedule = () => queueTooltipForAdjustment(container);
  container.addEventListener('mouseenter', schedule);
  container.addEventListener('focus', schedule);
  container.addEventListener('pointerdown', schedule);
}

function ensureGlobalTooltipGuards() {
  if (tooltipGuardsBound) {
    return;
  }
  tooltipGuardsBound = true;

  const scheduleAll = () => {
    window.requestAnimationFrame(() => {
      activeTooltipContainers.forEach((container) => {
        adjustTooltipViewport(container);
      });
    });
  };

  window.addEventListener('scroll', scheduleAll, { passive: true });
  window.addEventListener('resize', scheduleAll);
}

function queueTooltipForAdjustment(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  activeTooltipContainers.add(container);
  window.requestAnimationFrame(() => adjustTooltipViewport(container));
}

function adjustTooltipViewport(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (!container.isConnected) {
    activeTooltipContainers.delete(container);
    return;
  }

  const bubble = container.querySelector('.tooltip-bubble');
  if (!(bubble instanceof HTMLElement)) {
    return;
  }

  const maxWidth = Math.min(320, Math.max(180, window.innerWidth - 32));
  bubble.style.maxWidth = `${maxWidth}px`;

  // Keep tooltip placement fixed to the configured position.
}
