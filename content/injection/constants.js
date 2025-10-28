export const HOST_ATTRIBUTE = 'data-page-augmentor-id';
export const HOST_CLASS = 'page-augmentor-host';
export const NODE_CLASS = 'page-augmentor-node';

export const ALLOWED_STYLE_KEYS = new Set([
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'color',
  'backgroundColor',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'padding',
  'border',
  'borderRadius',
  'textDecoration',
  'maxWidth',
  'boxShadow',
  'width',
  'height',
  'zIndex',
]);

export const TOOLTIP_POSITIONS = new Set(['top', 'right', 'bottom', 'left']);

export const FLOW_SELF_SELECTOR = ':self';
export const FLOW_MAX_RUNTIME_MS = 10000;
export const FLOW_MAX_DEPTH = 8;
