import { ALLOWED_STYLE_KEYS, NODE_CLASS, TOOLTIP_POSITIONS, kebabCase } from './core/index.js';
import {
  DEFAULT_BUTTON_STYLE,
  DEFAULT_LINK_STYLE,
  DEFAULT_AREA_STYLE,
  DEFAULT_TOOLTIP_STYLE,
} from '../bubble/styles/style-presets.js';

export function applyStyle(node, style) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const whitelist = style || {};
  const nodeType = node.dataset?.nodeType || '';
  ALLOWED_STYLE_KEYS.forEach((key) => {
    const isPositionKey = key === 'position' || key === 'top' || key === 'right' || key === 'bottom' || key === 'left' || key === 'zIndex';
    // Area/tooltip nodes never receive direct absolute positioning styles;
    // their placement is handled by the host and tooltip layout helpers.
    if ((nodeType === 'area' || nodeType === 'tooltip') && isPositionKey) {
      node.style.removeProperty(kebabCase(key));
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(whitelist, key)) {
      // Leave existing/baseline styles intact when the style map does not
      // declare an override for this key.
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
    node.style.padding = DEFAULT_AREA_STYLE.padding || '16px';
    node.style.borderRadius = DEFAULT_AREA_STYLE.borderRadius || '14px';
    node.style.backgroundColor = DEFAULT_AREA_STYLE.backgroundColor || 'transparent';
    node.style.position = 'relative';
    node.style.color = DEFAULT_AREA_STYLE.color || '#0f172a';
    node.style.lineHeight = '1.5';
    return;
  }
  if (type === 'link') {
    node.removeAttribute('type');
    node.style.display = 'inline';
    node.style.color = DEFAULT_LINK_STYLE.color || '#2563eb';
    node.style.textDecoration = DEFAULT_LINK_STYLE.textDecoration || 'underline';
    node.style.backgroundColor = 'transparent';
    node.style.padding = '0.5rem 1rem';
    node.style.lineHeight = 'inherit';
    node.style.border = 'none';
    node.style.cursor = 'pointer';
    if (node instanceof HTMLAnchorElement) {
      node.setAttribute('role', 'link');
    }
  } else if (type === 'tooltip') {
    node.style.display = 'inline-block';
    node.style.color = DEFAULT_TOOLTIP_STYLE.color || '#f8fafc';
    node.style.backgroundColor = DEFAULT_TOOLTIP_STYLE.backgroundColor || 'rgba(17, 24, 39, 0.5)';
    node.style.fontSize = DEFAULT_TOOLTIP_STYLE.fontSize || '12px';
    node.style.padding = DEFAULT_TOOLTIP_STYLE.padding || '8px 12px';
    node.style.borderRadius = DEFAULT_TOOLTIP_STYLE.borderRadius || '12px';
    if (DEFAULT_TOOLTIP_STYLE.width) {
      node.style.width = DEFAULT_TOOLTIP_STYLE.width;
    }
    node.style.lineHeight = '1.2';
  } else {
    if (node instanceof HTMLButtonElement) {
      node.type = 'button';
    }
    node.style.display = 'inline-flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
    node.style.padding = DEFAULT_BUTTON_STYLE.padding || '0.5rem 1rem';
    node.style.borderRadius = DEFAULT_BUTTON_STYLE.borderRadius || '8px';
    node.style.backgroundColor = DEFAULT_BUTTON_STYLE.backgroundColor || '#1b84ff';
    node.style.color = DEFAULT_BUTTON_STYLE.color || '#ffffff';
    node.style.fontSize = DEFAULT_BUTTON_STYLE.fontSize || '16px';
    node.style.fontWeight = DEFAULT_BUTTON_STYLE.fontWeight || '600';
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


