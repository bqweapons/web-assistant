import { buildDefaultSiteUrl, deriveSiteKey, type StructuredElementRecord } from './siteDataSchema';

export type RuntimeElementRecord = {
  id: string;
  type: 'button' | 'link' | 'tooltip' | 'area';
  text: string;
  selector: string;
  position: 'append' | 'prepend' | 'before' | 'after';
  beforeSelector?: string;
  afterSelector?: string;
  containerId?: string;
  floating: boolean;
  layout?: 'row' | 'column';
  href?: string;
  actionSelector?: string;
  linkTarget?: 'new-tab' | 'same-tab';
  tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
  tooltipPersistent?: boolean;
  actionFlowId?: string;
  actionFlowLocked?: boolean;
  actionFlow?: string;
  style: StructuredElementRecord['style'];
  scope: StructuredElementRecord['scope'];
  siteUrl: string;
  pageUrl: string;
  frameUrl: string;
  frameSelectors: string[];
  createdAt: number;
  updatedAt: number;
};

const resolvePageUrlFromKey = (siteKey: string, pageKey?: string | null, scope?: unknown) => {
  const normalizedScope = scope === 'site' || scope === 'global' ? scope : 'page';
  const siteUrl = buildDefaultSiteUrl(siteKey);
  if (normalizedScope !== 'page') {
    return siteUrl;
  }
  if (!pageKey) {
    return siteUrl;
  }
  if (pageKey.startsWith('http://') || pageKey.startsWith('https://') || pageKey.startsWith('file://')) {
    return pageKey;
  }
  if (siteKey.startsWith('/')) {
    return pageKey.startsWith('/') ? `file://${pageKey}` : `file:///${pageKey}`;
  }
  if (pageKey.startsWith('/')) {
    return `${siteUrl.replace(/\/$/, '')}${pageKey}`;
  }
  if (pageKey === siteKey || pageKey.startsWith(`${siteKey}/`)) {
    return `https://${pageKey}`;
  }
  return `${siteUrl.replace(/\/$/, '')}/${pageKey.replace(/^\/+/, '')}`;
};

export const structuredElementToRuntimeElement = (
  element: StructuredElementRecord,
  fallbackSiteKey: string,
): RuntimeElementRecord => {
  const behaviorType =
    element.behavior.type === 'button' ||
    element.behavior.type === 'link' ||
    element.behavior.type === 'tooltip' ||
    element.behavior.type === 'area'
      ? element.behavior.type
      : 'button';
  const site = deriveSiteKey(element.context.siteKey || fallbackSiteKey) || fallbackSiteKey;
  const siteUrl = buildDefaultSiteUrl(site);
  const pageUrl = resolvePageUrlFromKey(site, element.context.pageKey, element.scope);
  const frameUrl = element.context.frame?.url || pageUrl;
  const frameSelectors = element.context.frame?.selectors || [];
  return {
    id: element.id,
    type: behaviorType,
    text: element.text,
    selector: element.placement.selector,
    position: element.placement.position,
    beforeSelector: element.placement.relativeTo.before,
    afterSelector: element.placement.relativeTo.after,
    containerId: element.placement.containerId,
    floating: element.placement.mode === 'floating' || element.placement.floating === true,
    layout: element.behavior.layout,
    href: element.behavior.href,
    actionSelector: element.behavior.actionSelector,
    linkTarget: element.behavior.target,
    tooltipPosition: element.behavior.tooltipPosition,
    tooltipPersistent: element.behavior.tooltipPersistent,
    actionFlowId: element.behavior.actionFlowId,
    actionFlowLocked: element.behavior.actionFlowLocked,
    actionFlow: element.behavior.actionFlow,
    style: element.style,
    scope: element.scope,
    siteUrl,
    pageUrl,
    frameUrl,
    frameSelectors,
    createdAt: element.createdAt,
    updatedAt: element.updatedAt,
  };
};
