import { ALLOWED_STYLE_KEYS, NODE_CLASS, TOOLTIP_POSITIONS, kebabCase } from '../core/index.js';

export function applyStyle(node, style) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const whitelist = style || {};
  const nodeType = node.dataset?.nodeType || '';
  ALLOWED_STYLE_KEYS.forEach((key) => {
    if (
      nodeType === 'area' &&
      (key === 'position' || key === 'top' || key === 'right' || key === 'bottom' || key === 'left' || key === 'zIndex')
    ) {
      node.style.removeProperty(kebabCase(key));
      return;
    }
    const value = whitelist[key];
    if (typeof value === 'string' && value.trim() !== '') {
      node.style[key] = value.trim();
    } else {
      node.style.removeProperty(kebabCase(key));
    }
  });
}

export function applyBaseAppearance(node, type) {
  node.className = NODE_CLASS;
  node.dataset.nodeType = type;
  node.removeAttribute('style');
  node.style.fontFamily = 'inherit';
  if (type === 'area') {
    node.style.display = 'flex';
    node.style.flexDirection = 'column';
    node.style.gap = '0.75rem';
    node.style.boxSizing = 'border-box';
    node.style.minHeight = '80px';
    node.style.padding = '16px';
    node.style.borderRadius = '14px';
    node.style.backgroundColor = 'rgba(37, 99, 235, 0.12)';
    node.style.border = '1px dashed rgba(37, 99, 235, 0.4)';
    node.style.position = 'relative';
    node.style.color = '#0f172a';
    node.style.lineHeight = '1.5';
    node.style.cursor = 'move';
    return;
  }
  if (type === 'link') {
    node.removeAttribute('type');
    node.style.display = 'inline';
    node.style.color = '#2563eb';
    node.style.textDecoration = 'underline';
    node.style.backgroundColor = 'transparent';
    node.style.padding = '0.5rem 1rem';
    node.style.lineHeight = 'inherit';
    node.style.border = 'none';
    node.style.cursor = 'pointer';
    if (node instanceof HTMLAnchorElement) {
      node.setAttribute('role', 'link');
    }
  } else {
    if (node instanceof HTMLButtonElement) {
      node.type = 'button';
    }
    node.style.display = 'inline-flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
    node.style.padding = '0.5rem 1rem';
    node.style.borderRadius = '8px';
    node.style.backgroundColor = '#1b84ff';
    node.style.color = '#ffffff';
    node.style.fontSize = '16px';
    node.style.fontWeight = '600';
    node.style.lineHeight = '1.2';
    node.style.border = 'none';
    node.style.textDecoration = 'none';
    node.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.12)';
    node.style.cursor = 'pointer';
  }
}

export function getStyleTarget(node) {
  if (!(node instanceof HTMLElement)) {
    return null;
  }
  if (node.dataset.nodeType === 'tooltip') {
    const bubble = node.querySelector('.tooltip-bubble');
    if (bubble instanceof HTMLElement) {
      return bubble;
    }
  }
  return node;
}

export function normalizeTooltipPosition(position) {
  if (position && TOOLTIP_POSITIONS.has(position)) {
    return /** @type {'top' | 'right' | 'bottom' | 'left'} */ (position);
  }
  return 'top';
}



