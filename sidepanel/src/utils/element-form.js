import {
  DEFAULT_AREA_STYLE,
  DEFAULT_BUTTON_STYLE,
  DEFAULT_LINK_STYLE,
  DEFAULT_TOOLTIP_STYLE,
  STYLE_PRESETS,
} from '../../../content/bubble/styles/style-presets.js';
import { getStyleFieldConfigs } from '../../../content/bubble/editor/field-config.js';
import {
  getDefaultElementValues,
  resolvePosition,
  resolveTooltipPosition,
} from '../../../content/bubble/editor/defaults.js';
import { normalizeStyleState } from '../../../content/bubble/styles/style-normalize.js';
import { normalizePageLocation, normalizeSiteUrl } from '../../../common/url.js';

export const STYLE_PALETTE = [
  '#2563eb',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#64748b',
  '#000000',
  '#ffffff',
  'transparent',
];

export function buildStyleState(source = {}, t) {
  const fields = getStyleFieldConfigs(t);
  const names = fields.map((field) => field.key || field.name).filter(Boolean);
  return names.reduce((acc, name) => {
    acc[name] = typeof source[name] === 'string' ? source[name] : '';
    return acc;
  }, {});
}

function resolveType(type) {
  if (type === 'link' || type === 'tooltip' || type === 'area') {
    return type;
  }
  return 'button';
}

export function detectStylePreset(style = {}) {
  const keys = Object.keys(style || {});
  const normalizedStyle = keys.reduce((acc, key) => {
    acc[key] = typeof style[key] === 'string' ? style[key].trim() : '';
    return acc;
  }, {});
  const match = STYLE_PRESETS.find((preset) => {
    if (!preset.styles) return false;
    const entries = Object.entries(preset.styles);
    if (entries.length === 0) return false;
    return entries.every(([key, value]) => (normalizedStyle[key] || '').trim() === (value || '').trim());
  });
  return match?.value || '';
}

export function initializeProperties(item = {}, t) {
  const source = item && typeof item === 'object' ? item : {};
  const defaults = getDefaultElementValues(source, source?.style || {}, t);
  const styleState = buildStyleState(defaults.style, t);
  const scope =
    source?.siteUrl && source?.pageUrl && (source.siteUrl === source.pageUrl || `${source.siteUrl}/` === source.pageUrl)
      ? 'site'
      : 'page';
  return {
    type: resolveType(defaults.type),
    text: defaults.text || '',
    href: defaults.href || '',
    selector: source?.selector || '',
    actionSelector: source?.actionSelector || '',
    actionFlowId: source?.actionFlowId || '',
    actionFlowLocked: Boolean(source?.actionFlowLocked),
    linkTarget: defaults.linkTarget || 'new-tab',
    tooltipPosition: defaults.tooltipPosition || 'top',
    tooltipPersistent: Boolean(defaults.tooltipPersistent),
    position: defaults.position || 'append',
    layout: defaults.layout || 'row',
    style: styleState,
    stylePreset: detectStylePreset(styleState),
    scope,
    pageUrl: source?.pageUrl || '',
    siteUrl: source?.siteUrl || '',
    containerId: source?.containerId || '',
    floating: source?.floating !== false,
  };
}

export function normalizePropertiesForSave(form = {}, t, options = {}) {
  const type = resolveType(form.type);
  const linkTarget = form.linkTarget === 'same-tab' ? 'same-tab' : 'new-tab';
  const position = resolvePosition(form.position);
  const layout = form.layout === 'column' ? 'column' : 'row';
  const tooltipPosition = resolveTooltipPosition(form.tooltipPosition);
  const scope = form.scope === 'site' ? 'site' : 'page';
  const style = normalizeStyleState(form.style || {}, () => getStyleFieldConfigs(t));
  const text = typeof form.text === 'string' ? form.text.trim() : '';
  const href = typeof form.href === 'string' ? form.href.trim() : '';
  const selector = typeof form.selector === 'string' ? form.selector.trim() : '';
  const actionSelector = typeof form.actionSelector === 'string' ? form.actionSelector.trim() : '';
  const actionFlowId = typeof form.actionFlowId === 'string' ? form.actionFlowId.trim() : '';
  const containerId = typeof form.containerId === 'string' ? form.containerId.trim() : '';
  const floating = form.floating !== false;

  const fallbackSite = options.fallbackSiteUrl || '';
  const fallbackPage = options.fallbackPageUrl || fallbackSite || '';

  let siteUrl = typeof form.siteUrl === 'string' ? form.siteUrl : '';
  let pageUrl = typeof form.pageUrl === 'string' ? form.pageUrl : '';

  if (scope === 'site') {
    const normalized = normalizeSiteUrl(siteUrl || pageUrl || fallbackPage);
    siteUrl = normalized;
    pageUrl = normalized;
  } else {
    const normalizedPage = normalizePageLocation(pageUrl || fallbackPage);
    pageUrl = normalizedPage;
    siteUrl = normalizeSiteUrl(siteUrl || normalizedPage || fallbackSite);
  }

  return {
    type,
    text,
    href,
    selector,
    actionSelector,
    actionFlowId,
    actionFlowLocked: Boolean(form.actionFlowLocked),
    linkTarget,
    tooltipPosition,
    tooltipPersistent: Boolean(form.tooltipPersistent),
    position,
    layout,
    style,
    stylePreset: form.stylePreset || '',
    scope,
    pageUrl,
    siteUrl,
    containerId,
    floating,
  };
}

export function presetStylesForType(type) {
  if (type === 'link') return DEFAULT_LINK_STYLE;
  if (type === 'tooltip') return DEFAULT_TOOLTIP_STYLE;
  if (type === 'area') return DEFAULT_AREA_STYLE;
  return DEFAULT_BUTTON_STYLE;
}

export { STYLE_PRESETS, getStyleFieldConfigs };
