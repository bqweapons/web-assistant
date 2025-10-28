import { NODE_CLASS, TOOLTIP_POSITIONS } from './constants.js';
import { normalizeTooltipPosition } from './style.js';

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
  trigger.textContent = 'ⓘ';
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
