import { NODE_CLASS, TOOLTIP_POSITIONS } from '../core/constants.js';
import { normalizeTooltipPosition } from '../ui/style.js';

export function createTooltipNode() {
  const container = document.createElement('div');
  applyTooltipAppearance(container);
  return container;
}

export function applyTooltipAppearance(node) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  node.className = `${NODE_CLASS} tooltip`;
  node.dataset.nodeType = 'tooltip';
  if (!TOOLTIP_POSITIONS.has(node.dataset.position || '')) {
    node.dataset.position = 'top';
  }
  if (node.dataset.persistent !== 'true' && node.dataset.persistent !== 'false') {
    node.dataset.persistent = 'false';
  }
  node.setAttribute('data-position', node.dataset.position);
  node.setAttribute('data-persistent', node.dataset.persistent);
  node.setAttribute('role', 'group');
  node.tabIndex = 0;

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

export function bindTooltipViewportGuards(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (container.dataset.tooltipGuard === 'true') {
    return;
  }
  container.dataset.tooltipGuard = 'true';

  const handler = () => adjustTooltipViewport(container);
  const schedule = () => window.requestAnimationFrame(handler);
  container.addEventListener('mouseenter', schedule);
  container.addEventListener('focus', schedule);
  container.addEventListener('pointerdown', schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
}

function adjustTooltipViewport(container) {
  if (!(container instanceof HTMLElement)) {
    return;
  }
  const bubble = container.querySelector('.tooltip-bubble');
  if (!(bubble instanceof HTMLElement)) {
    return;
  }
  const maxWidth = Math.min(320, Math.max(180, window.innerWidth - 32));
  bubble.style.maxWidth = `${maxWidth}px`;

  const margin = 16;
  const current = container.dataset.position || 'top';
  let desired = current;
  const rect = bubble.getBoundingClientRect();

  if (desired === 'right' && rect.right > window.innerWidth - margin) {
    desired = 'left';
  } else if (desired === 'left' && rect.left < margin) {
    desired = 'right';
  }

  if (desired === 'top' && rect.top < margin) {
    desired = 'bottom';
  } else if (desired === 'bottom' && rect.bottom > window.innerHeight - margin) {
    desired = 'top';
  }

  if (desired !== current) {
    configureTooltipPosition(container, bubble, desired);
  }
}





