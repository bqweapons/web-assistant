import { t } from '../../utils/i18n';
import type { MessageElementPayload } from '../../../../shared/messages';
import {
  buildDefaultSiteUrl,
  deriveSiteKey,
  isStructuredElementRecord,
  type StructuredElementRecord,
  type StructuredFlowRecord,
} from '../../../../shared/siteDataSchema';
import { normalizeFlowSteps, type FlowStepData } from '../../../../shared/flowStepMigration';
import {
  derivePageKeyFromUrl,
  normalizeSiteKey as normalizeSharedSiteKey,
} from '../../../../shared/urlKeys';

export type ElementInlineStyle = Record<string, string>;
export type ElementRecord = StructuredElementRecord;
export type ElementBehaviorType = StructuredElementRecord['behavior']['type'];
export type ElementPosition = StructuredElementRecord['placement']['position'];
export type ElementScope = StructuredElementRecord['scope'];

export type FlowRecord = StructuredFlowRecord & {
  scope: 'page' | 'site' | 'global';
  siteKey: string;
  pageKey: string | null;
  steps: FlowStepData[];
  updatedAt: number;
};

export type StoredElementRecord = StructuredElementRecord;

export const buildElementsRehydrateSignature = (
  siteKey: string,
  pageKey: string,
  payload: MessageElementPayload[],
) => JSON.stringify({ siteKey, pageKey, payload });

export const isElementType = (value: unknown): value is ElementBehaviorType =>
  value === 'button' || value === 'link' || value === 'tooltip' || value === 'area';

const isElementPosition = (value: unknown): value is ElementPosition =>
  value === 'append' || value === 'prepend' || value === 'before' || value === 'after';

export const normalizeElementPosition = (value: unknown): ElementPosition =>
  isElementPosition(value) ? value : 'append';

export const normalizeElementScope = (value: unknown): ElementScope =>
  value === 'site' || value === 'global' ? value : 'page';

const isStyleRecord = (value: unknown): value is Record<string, string> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const normalizeStyle = (
  rawStyle: unknown,
  legacyPreset?: string,
  legacyCustomCss?: string,
): StructuredElementRecord['style'] => {
  if (
    rawStyle &&
    typeof rawStyle === 'object' &&
    !Array.isArray(rawStyle) &&
    ('inline' in rawStyle || 'preset' in rawStyle || 'customCss' in rawStyle)
  ) {
    const typed = rawStyle as { preset?: unknown; inline?: unknown; customCss?: unknown };
    return {
      preset: typeof typed.preset === 'string' ? typed.preset : legacyPreset,
      inline: isStyleRecord(typed.inline) ? typed.inline : {},
      customCss: typeof typed.customCss === 'string' ? typed.customCss : legacyCustomCss || '',
    };
  }
  return {
    preset: legacyPreset,
    inline: isStyleRecord(rawStyle) ? rawStyle : {},
    customCss: legacyCustomCss || '',
  };
};

export const resolveStructuredPageUrl = (
  siteKey: string,
  pageKey?: string | null,
  scope?: unknown,
) => {
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

export const normalizeStoredElement = (
  element: unknown,
  fallbackSiteKey = '',
): StoredElementRecord | null => {
  if (!isStructuredElementRecord(element)) {
    return null;
  }
  const siteKey =
    deriveSiteKey(element.context.siteKey || '') ||
    deriveSiteKey(fallbackSiteKey || '') ||
    fallbackSiteKey;
  if (!siteKey) {
    return null;
  }
  const scope = normalizeElementScope(element.scope);
  return {
    ...element,
    text: typeof element.text === 'string' ? element.text : '',
    scope,
    context: {
      siteKey,
      pageKey: scope === 'page' ? element.context.pageKey ?? `${siteKey}/` : null,
      frame:
        element.context.frame && typeof element.context.frame === 'object'
          ? {
              url: typeof element.context.frame.url === 'string' ? element.context.frame.url : undefined,
              selectors: Array.isArray(element.context.frame.selectors)
                ? element.context.frame.selectors.filter((item): item is string => typeof item === 'string')
                : [],
            }
          : null,
    },
    placement: {
      mode:
        element.placement.mode === 'floating' || element.placement.mode === 'container'
          ? element.placement.mode
          : 'dom',
      selector: typeof element.placement.selector === 'string' ? element.placement.selector : '',
      position: normalizeElementPosition(element.placement.position),
      relativeTo: {
        before:
          typeof element.placement.relativeTo?.before === 'string'
            ? element.placement.relativeTo.before
            : undefined,
        after:
          typeof element.placement.relativeTo?.after === 'string'
            ? element.placement.relativeTo.after
            : undefined,
      },
      containerId:
        typeof element.placement.containerId === 'string' ? element.placement.containerId : undefined,
    },
    style: normalizeStyle(element.style),
    behavior: {
      type: isElementType(element.behavior.type) ? element.behavior.type : 'button',
      href: typeof element.behavior.href === 'string' ? element.behavior.href : undefined,
      target:
        element.behavior.target === 'same-tab'
          ? 'same-tab'
          : element.behavior.target === 'new-tab'
            ? 'new-tab'
            : undefined,
      actionSelector:
        typeof element.behavior.actionSelector === 'string' ? element.behavior.actionSelector : undefined,
      actionFlowId:
        typeof element.behavior.actionFlowId === 'string' ? element.behavior.actionFlowId : undefined,
      actionFlowLocked:
        typeof element.behavior.actionFlowLocked === 'boolean'
          ? element.behavior.actionFlowLocked
          : undefined,
      layout: element.behavior.layout === 'column' ? 'column' : element.behavior.layout === 'row' ? 'row' : undefined,
      tooltipPosition:
        element.behavior.tooltipPosition === 'top' ||
        element.behavior.tooltipPosition === 'right' ||
        element.behavior.tooltipPosition === 'bottom' ||
        element.behavior.tooltipPosition === 'left'
          ? element.behavior.tooltipPosition
          : undefined,
      tooltipPersistent:
        typeof element.behavior.tooltipPersistent === 'boolean'
          ? element.behavior.tooltipPersistent
          : undefined,
    },
    createdAt: typeof element.createdAt === 'number' ? element.createdAt : Date.now(),
    updatedAt: typeof element.updatedAt === 'number' ? element.updatedAt : Date.now(),
  };
};

export const toMessageElementPayload = (element: StoredElementRecord): MessageElementPayload => element;

export type ElementResolvedContext = {
  siteKey: string;
  siteUrl: string;
  pageKey: string | null;
  pageUrl: string;
  frameUrl: string;
  frameSelectors: string[];
};

export const normalizeSiteKey = normalizeSharedSiteKey;

const toFlowTimestamp = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
};

export const normalizeFlowRecord = (value: unknown, fallbackSiteKey: string): FlowRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const entry = value as Partial<FlowRecord> & { site?: string };
  if (!entry.id || typeof entry.id !== 'string') {
    return null;
  }
  const resolvedSiteKey =
    deriveSiteKey(typeof entry.siteKey === 'string' ? entry.siteKey : '') ||
    deriveSiteKey(typeof entry.site === 'string' ? entry.site : '') ||
    fallbackSiteKey;
  if (!resolvedSiteKey) {
    return null;
  }
  return {
    id: entry.id,
    name:
      typeof entry.name === 'string' && entry.name.trim()
        ? entry.name.trim()
        : t('sidepanel_flows_new_default', 'New flow'),
    description: typeof entry.description === 'string' ? entry.description : '',
    scope: entry.scope === 'page' || entry.scope === 'global' ? entry.scope : 'site',
    siteKey: resolvedSiteKey,
    pageKey: typeof entry.pageKey === 'string' ? entry.pageKey : null,
    steps: (normalizeFlowSteps(entry.steps, {
      flowId: entry.id,
      keepNumber: false,
      sanitizeExisting: true,
    }) as FlowStepData[]),
    updatedAt: toFlowTimestamp(entry.updatedAt),
  };
};

export const toStructuredPageKey = (
  pageUrl: string,
  scope: ElementScope,
  siteKey: string,
) => {
  if (scope !== 'page') {
    return null;
  }
  const trimmed = pageUrl.trim();
  if (!trimmed) {
    return siteKey ? `${siteKey}/` : null;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'file:') {
        return trimmed.split(/[?#]/)[0] || trimmed;
      }
      const host = normalizeSiteKey(parsed.host || parsed.hostname || siteKey);
      const path = parsed.pathname || '/';
      return `${host}${path.startsWith('/') ? path : `/${path}`}`;
    } catch {
      return trimmed;
    }
  }
  if (trimmed.startsWith('/')) {
    return `${siteKey}${trimmed}`;
  }
  const withoutScheme = trimmed.replace(/^https?:\/\//, '').replace(/^file:\/\//, '');
  const withoutQuery = (withoutScheme.split(/[?#]/)[0] || withoutScheme).trim();
  if (!withoutQuery) {
    return siteKey ? `${siteKey}/` : null;
  }
  const slashIndex = withoutQuery.indexOf('/');
  if (slashIndex === -1) {
    const normalizedHost = normalizeSiteKey(withoutQuery);
    return normalizedHost ? `${normalizedHost}/` : null;
  }
  const normalizedHost = normalizeSiteKey(withoutQuery.slice(0, slashIndex));
  const pathRaw = withoutQuery.slice(slashIndex);
  const path = pathRaw ? `/${pathRaw.replace(/^\/+/, '')}` : '/';
  return normalizedHost ? `${normalizedHost}${path}` : path;
};

export const resolveElementContext = (
  element: ElementRecord,
  fallbackSiteKey = '',
): ElementResolvedContext => {
  const scope = normalizeElementScope(element.scope);
  const siteKey = deriveSiteKey(element.context.siteKey || '') || fallbackSiteKey;
  const pageKey =
    scope === 'page'
      ? element.context.pageKey ?? toStructuredPageKey(resolveStructuredPageUrl(siteKey, element.context.pageKey, scope), scope, siteKey)
      : null;
  const siteUrl = buildDefaultSiteUrl(siteKey);
  const pageUrl = resolveStructuredPageUrl(siteKey, pageKey, scope);
  const frameUrl =
    typeof element.context.frame?.url === 'string' && element.context.frame.url.trim()
      ? element.context.frame.url
      : pageUrl;
  const frameSelectors = Array.isArray(element.context.frame?.selectors)
    ? element.context.frame.selectors.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    siteKey,
    siteUrl,
    pageKey,
    pageUrl,
    frameUrl,
    frameSelectors,
  };
};

export const normalizePageKey = (value?: string, fallbackSiteKey?: string) => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  try {
    return derivePageKeyFromUrl(trimmed);
  } catch {
    if (trimmed.startsWith('/')) {
      const baseSiteKey = normalizeSiteKey(fallbackSiteKey || '');
      return baseSiteKey ? `${baseSiteKey}${trimmed}` : trimmed;
    }
    const withoutScheme = trimmed.replace(/^https?:\/\//, '').replace(/^file:\/\//, '');
    const withoutQuery = (withoutScheme.split(/[?#]/)[0] || withoutScheme).trim();
    if (!withoutQuery) {
      return '';
    }
    const slashIndex = withoutQuery.indexOf('/');
    if (slashIndex === -1) {
      const siteOnly = normalizeSiteKey(withoutQuery);
      return siteOnly ? `${siteOnly}/` : '';
    }
    const siteKey = normalizeSiteKey(withoutQuery.slice(0, slashIndex));
    const pathRaw = withoutQuery.slice(slashIndex);
    const path = pathRaw ? `/${pathRaw.replace(/^\/+/, '')}` : '/';
    return siteKey ? `${siteKey}${path}` : path;
  }
};

export const getElementType = (element: ElementRecord) => element.behavior.type;
export const getElementSelector = (element: ElementRecord) => element.placement.selector || '';
export const getElementPosition = (element: ElementRecord) => normalizeElementPosition(element.placement.position);
export const getElementScope = (element: ElementRecord) => normalizeElementScope(element.scope);
export const getElementFloating = (element: ElementRecord) => element.placement.mode === 'floating';
export const getElementHref = (element: ElementRecord) => element.behavior.href || '';
export const getElementLinkTarget = (element: ElementRecord) => element.behavior.target || 'new-tab';
export const getElementLayout = (element: ElementRecord) => element.behavior.layout || 'row';
export const getElementActionFlowId = (element: ElementRecord) => element.behavior.actionFlowId || '';
