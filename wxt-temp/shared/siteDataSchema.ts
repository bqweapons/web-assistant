import { normalizeFlowSteps } from './flowStepMigration';

type JsonRecord = Record<string, unknown>;

export type StructuredFrameContext = {
  url?: string;
  selectors?: string[];
};

export type StructuredElementRecord = {
  id: string;
  text: string;
  scope: 'page' | 'site' | 'global';
  context: {
    siteKey: string;
    pageKey: string | null;
    frame: StructuredFrameContext | null;
  };
  placement: {
    mode: 'dom' | 'floating' | 'container';
    selector: string;
    position: 'append' | 'prepend' | 'before' | 'after';
    relativeTo: {
      before?: string;
      after?: string;
    };
    containerId?: string;
    floating?: boolean;
  };
  style: {
    preset?: string;
    inline: Record<string, string>;
    customCss: string;
  };
  behavior: {
    type: 'button' | 'link' | 'tooltip' | 'area';
    href?: string;
    target?: 'new-tab' | 'same-tab';
    actionSelector?: string;
    actionFlowId?: string;
    actionFlowLocked?: boolean;
    actionFlow?: string;
    layout?: 'row' | 'column';
    tooltipPosition?: 'top' | 'right' | 'bottom' | 'left';
    tooltipPersistent?: boolean;
  };
  createdAt: number;
  updatedAt: number;
};

export type StructuredFlowRecord = {
  id: string;
  name: string;
  description: string;
  scope?: 'page' | 'site' | 'global';
  siteKey?: string;
  pageKey?: string | null;
  steps: unknown[] | number;
  updatedAt: number;
};

export type StructuredHiddenRecord = {
  id: string;
  name: string;
  note?: string;
  scope?: 'page' | 'site' | 'global';
  siteKey?: string;
  pageKey?: string | null;
  selector: string;
  enabled?: boolean;
  updatedAt: number;
};

export type StructuredSiteData = {
  elements: StructuredElementRecord[];
  flows: StructuredFlowRecord[];
  hidden: StructuredHiddenRecord[];
};

export type StructuredStoragePayload = {
  sites: Record<string, StructuredSiteData>;
};

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isElementType = (value: unknown): value is StructuredElementRecord['behavior']['type'] =>
  value === 'button' || value === 'link' || value === 'tooltip' || value === 'area';

const isElementPosition = (
  value: unknown,
): value is StructuredElementRecord['placement']['position'] =>
  value === 'append' || value === 'prepend' || value === 'before' || value === 'after';

export const normalizeSiteKey = (value: string) =>
  value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');

export const deriveSiteKey = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'file:') {
      return normalizeSiteKey(trimmed.split(/[?#]/)[0] || trimmed);
    }
    const host = parsed.host || parsed.hostname || '';
    return normalizeSiteKey(host || trimmed);
  } catch {
    return normalizeSiteKey(trimmed);
  }
};

export const buildDefaultSiteUrl = (siteKey: string) => {
  if (!siteKey) {
    return '';
  }
  if (siteKey.startsWith('http://') || siteKey.startsWith('https://') || siteKey.startsWith('file://')) {
    return siteKey;
  }
  if (siteKey.startsWith('/')) {
    return `file://${siteKey}`;
  }
  return `https://${siteKey}`;
};

const normalizeStringRecord = (value: unknown) => {
  if (!isRecord(value)) {
    return {} as Record<string, string>;
  }
  const next: Record<string, string> = {};
  Object.entries(value).forEach(([key, raw]) => {
    if (typeof raw !== 'string') {
      return;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    next[key] = trimmed;
  });
  return next;
};

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

const formatCustomCss = (rules: Record<string, string>) =>
  Object.entries(rules)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => Boolean(key) && Boolean(value))
    .map(([key, value]) => `${toKebabCase(key)}: ${value};`)
    .join('\n');

const normalizeStyle = (
  rawStyle: unknown,
  legacyPreset?: unknown,
  legacyCustomCss?: unknown,
): StructuredElementRecord['style'] => {
  if (isRecord(rawStyle) && ('inline' in rawStyle || 'preset' in rawStyle || 'customCss' in rawStyle)) {
    const inline = normalizeStringRecord(rawStyle.inline);
    const customCss =
      typeof rawStyle.customCss === 'string'
        ? rawStyle.customCss
        : typeof legacyCustomCss === 'string'
          ? legacyCustomCss
          : formatCustomCss(inline);
    return {
      preset:
        typeof rawStyle.preset === 'string'
          ? rawStyle.preset
          : typeof legacyPreset === 'string'
            ? legacyPreset
            : undefined,
      inline,
      customCss,
    };
  }

  const inline = normalizeStringRecord(rawStyle);
  return {
    preset: typeof legacyPreset === 'string' ? legacyPreset : undefined,
    inline,
    customCss: typeof legacyCustomCss === 'string' ? legacyCustomCss : formatCustomCss(inline),
  };
};

const asNumberTimestamp = (value: unknown) => {
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

const resolvePageKey = (
  pageUrl: string,
  scope: 'page' | 'site' | 'global',
  siteKey: string,
): string | null => {
  if (scope !== 'page') {
    return null;
  }
  const normalized = pageUrl.trim();
  if (!normalized) {
    return siteKey ? `${siteKey}/` : null;
  }
  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('file://')) {
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol === 'file:') {
        return normalized.split(/[?#]/)[0] || normalized;
      }
      const host = normalizeSiteKey(parsed.host || parsed.hostname || siteKey);
      const path = parsed.pathname || '/';
      return `${host}${path.startsWith('/') ? path : `/${path}`}`;
    } catch {
      return normalized;
    }
  }
  return normalized;
};


export const isStructuredElementRecord = (raw: unknown): raw is StructuredElementRecord =>
  isRecord(raw) &&
  isRecord(raw.context) &&
  isRecord(raw.placement) &&
  isRecord(raw.behavior);

const normalizeStructuredElement = (raw: StructuredElementRecord, fallbackSiteKey: string): StructuredElementRecord => {
  const siteKey = deriveSiteKey(raw.context.siteKey || fallbackSiteKey) || fallbackSiteKey;
  const behaviorType = isElementType(raw.behavior.type) ? raw.behavior.type : 'button';
  const scope = raw.scope === 'site' || raw.scope === 'global' ? raw.scope : 'page';
  const position = isElementPosition(raw.placement.position) ? raw.placement.position : 'append';
  const frame =
    raw.context.frame && isRecord(raw.context.frame)
      ? {
          url: typeof raw.context.frame.url === 'string' ? raw.context.frame.url : undefined,
          selectors: Array.isArray(raw.context.frame.selectors)
            ? raw.context.frame.selectors.filter((item): item is string => typeof item === 'string')
            : undefined,
        }
      : null;
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `element-${Date.now()}`,
    text: typeof raw.text === 'string' ? raw.text : '',
    scope,
    context: {
      siteKey,
      pageKey: typeof raw.context.pageKey === 'string' ? raw.context.pageKey : null,
      frame,
    },
    placement: {
      mode: raw.placement.mode === 'floating' || raw.placement.mode === 'container' ? raw.placement.mode : 'dom',
      selector: typeof raw.placement.selector === 'string' ? raw.placement.selector : '',
      position,
      relativeTo: {
        before:
          isRecord(raw.placement.relativeTo) && typeof raw.placement.relativeTo.before === 'string'
            ? raw.placement.relativeTo.before
            : undefined,
        after:
          isRecord(raw.placement.relativeTo) && typeof raw.placement.relativeTo.after === 'string'
            ? raw.placement.relativeTo.after
            : undefined,
      },
      containerId: typeof raw.placement.containerId === 'string' ? raw.placement.containerId : undefined,
      floating: typeof raw.placement.floating === 'boolean' ? raw.placement.floating : undefined,
    },
    style: normalizeStyle(raw.style),
    behavior: {
      type: behaviorType,
      href: typeof raw.behavior.href === 'string' ? raw.behavior.href : undefined,
      target: raw.behavior.target === 'same-tab' ? 'same-tab' : raw.behavior.target === 'new-tab' ? 'new-tab' : undefined,
      actionSelector:
        typeof raw.behavior.actionSelector === 'string' ? raw.behavior.actionSelector : undefined,
      actionFlowId: typeof raw.behavior.actionFlowId === 'string' ? raw.behavior.actionFlowId : undefined,
      actionFlowLocked:
        typeof raw.behavior.actionFlowLocked === 'boolean' ? raw.behavior.actionFlowLocked : undefined,
      actionFlow: typeof raw.behavior.actionFlow === 'string' ? raw.behavior.actionFlow : undefined,
      layout: raw.behavior.layout === 'column' ? 'column' : raw.behavior.layout === 'row' ? 'row' : undefined,
      tooltipPosition:
        raw.behavior.tooltipPosition === 'top' ||
        raw.behavior.tooltipPosition === 'right' ||
        raw.behavior.tooltipPosition === 'bottom' ||
        raw.behavior.tooltipPosition === 'left'
          ? raw.behavior.tooltipPosition
          : undefined,
      tooltipPersistent:
        typeof raw.behavior.tooltipPersistent === 'boolean' ? raw.behavior.tooltipPersistent : undefined,
    },
    createdAt: asNumberTimestamp(raw.createdAt),
    updatedAt: asNumberTimestamp(raw.updatedAt),
  };
};

const normalizeFlatElement = (raw: unknown, siteKey: string): StructuredElementRecord | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const behaviorType = isElementType(raw.type) ? raw.type : 'button';
  const scope = raw.scope === 'site' || raw.scope === 'global' ? raw.scope : 'page';
  const resolvedSiteUrl =
    typeof raw.siteUrl === 'string' && raw.siteUrl.trim() ? raw.siteUrl.trim() : buildDefaultSiteUrl(siteKey);
  const resolvedPageUrl =
    typeof raw.pageUrl === 'string' && raw.pageUrl.trim() ? raw.pageUrl.trim() : resolvedSiteUrl;
  const resolvedFrameUrl =
    typeof raw.frameUrl === 'string' && raw.frameUrl.trim() ? raw.frameUrl.trim() : resolvedPageUrl;
  const frameSelectors = Array.isArray(raw.frameSelectors)
    ? raw.frameSelectors.filter((item): item is string => typeof item === 'string')
    : [];
  const position = isElementPosition(raw.position) ? raw.position : 'append';
  const containerId = typeof raw.containerId === 'string' && raw.containerId.trim() ? raw.containerId.trim() : undefined;
  const floating = typeof raw.floating === 'boolean' ? raw.floating : behaviorType === 'area';
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `element-${Date.now()}`,
    text: typeof raw.text === 'string' ? raw.text : '',
    scope,
    context: {
      siteKey: deriveSiteKey(resolvedSiteUrl) || siteKey,
      pageKey: resolvePageKey(resolvedPageUrl, scope, siteKey),
      frame:
        frameSelectors.length > 0 || resolvedFrameUrl !== resolvedPageUrl
          ? {
              url: resolvedFrameUrl,
              selectors: frameSelectors,
            }
          : null,
    },
    placement: {
      mode: containerId ? 'container' : floating ? 'floating' : 'dom',
      selector: typeof raw.selector === 'string' ? raw.selector : '',
      position,
      relativeTo: {
        before: typeof raw.beforeSelector === 'string' ? raw.beforeSelector : undefined,
        after: typeof raw.afterSelector === 'string' ? raw.afterSelector : undefined,
      },
      containerId,
      floating,
    },
    style: normalizeStyle(raw.style, raw.stylePreset, raw.customCss),
    behavior: {
      type: behaviorType,
      href: typeof raw.href === 'string' ? raw.href : undefined,
      target: raw.linkTarget === 'same-tab' ? 'same-tab' : raw.linkTarget === 'new-tab' ? 'new-tab' : undefined,
      actionSelector: typeof raw.actionSelector === 'string' ? raw.actionSelector : undefined,
      actionFlowId: typeof raw.actionFlowId === 'string' ? raw.actionFlowId : undefined,
      actionFlowLocked: typeof raw.actionFlowLocked === 'boolean' ? raw.actionFlowLocked : undefined,
      actionFlow: typeof raw.actionFlow === 'string' ? raw.actionFlow : undefined,
      layout: raw.layout === 'column' ? 'column' : raw.layout === 'row' ? 'row' : undefined,
      tooltipPosition:
        raw.tooltipPosition === 'top' ||
        raw.tooltipPosition === 'right' ||
        raw.tooltipPosition === 'bottom' ||
        raw.tooltipPosition === 'left'
          ? raw.tooltipPosition
          : undefined,
      tooltipPersistent:
        typeof raw.tooltipPersistent === 'boolean' ? raw.tooltipPersistent : undefined,
    },
    createdAt: asNumberTimestamp(raw.createdAt),
    updatedAt: asNumberTimestamp(raw.updatedAt),
  };
};

const normalizeStructuredFlow = (raw: unknown, siteKey: string): StructuredFlowRecord | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `flow-${Date.now()}`;
  const normalizedSteps = normalizeFlowSteps(raw.steps, {
    flowId: id,
    keepNumber: true,
    sanitizeExisting: true,
  });
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Imported flow',
    description: typeof raw.description === 'string' ? raw.description : '',
    scope: raw.scope === 'page' || raw.scope === 'global' ? raw.scope : 'site',
    siteKey: typeof raw.siteKey === 'string' && raw.siteKey.trim() ? deriveSiteKey(raw.siteKey) : siteKey,
    pageKey: typeof raw.pageKey === 'string' ? raw.pageKey : null,
    steps: normalizedSteps,
    updatedAt: asNumberTimestamp(raw.updatedAt),
  };
};

const normalizeFlatFlow = (raw: unknown, siteKey: string): StructuredFlowRecord | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `flow-${Date.now()}`;
  const normalizedSteps = normalizeFlowSteps(raw.steps, {
    flowId: id,
    keepNumber: true,
    sanitizeExisting: true,
  });
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Imported flow',
    description: typeof raw.description === 'string' ? raw.description : '',
    scope: raw.scope === 'page' || raw.scope === 'global' ? raw.scope : 'site',
    siteKey,
    pageKey: typeof raw.pageKey === 'string' ? raw.pageKey : null,
    steps: normalizedSteps,
    updatedAt: asNumberTimestamp(raw.updatedAt),
  };
};

const normalizeStructuredHidden = (raw: unknown, siteKey: string): StructuredHiddenRecord | null => {
  if (!isRecord(raw)) {
    return null;
  }
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `hidden-${Date.now()}`,
    name: typeof raw.name === 'string' ? raw.name : 'Hidden rule',
    note: typeof raw.note === 'string' ? raw.note : undefined,
    scope: raw.scope === 'page' || raw.scope === 'global' ? raw.scope : 'site',
    siteKey: typeof raw.siteKey === 'string' && raw.siteKey.trim() ? deriveSiteKey(raw.siteKey) : siteKey,
    pageKey: typeof raw.pageKey === 'string' ? raw.pageKey : null,
    selector: typeof raw.selector === 'string' ? raw.selector : '',
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    updatedAt: asNumberTimestamp(raw.updatedAt),
  };
};

const normalizeFlatHidden = (raw: unknown, siteKey: string): StructuredHiddenRecord | null => {
  if (!isRecord(raw)) {
    return null;
  }
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `hidden-${Date.now()}`,
    name: typeof raw.name === 'string' ? raw.name : 'Hidden rule',
    note: typeof raw.note === 'string' ? raw.note : undefined,
    scope: raw.scope === 'page' || raw.scope === 'global' ? raw.scope : 'site',
    siteKey,
    pageKey: typeof raw.pageKey === 'string' ? raw.pageKey : null,
    selector: typeof raw.selector === 'string' ? raw.selector : '',
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    updatedAt: asNumberTimestamp(raw.updatedAt),
  };
};

const normalizeSiteDataToStructured = (siteKey: string, rawSiteData: unknown): StructuredSiteData => {
  if (!isRecord(rawSiteData)) {
    return { elements: [], flows: [], hidden: [] };
  }
  const rawElements = Array.isArray(rawSiteData.elements) ? rawSiteData.elements : [];
  const rawFlows = Array.isArray(rawSiteData.flows) ? rawSiteData.flows : [];
  const rawHidden = Array.isArray(rawSiteData.hidden) ? rawSiteData.hidden : [];

  const elements = rawElements
    .map((entry) => {
      if (isStructuredElementRecord(entry)) {
        return normalizeStructuredElement(entry, siteKey);
      }
      return normalizeFlatElement(entry, siteKey);
    })
    .filter((item): item is StructuredElementRecord => Boolean(item));

  const flows = rawFlows
    .map((entry) => {
      if (isRecord(entry) && 'siteKey' in entry && 'steps' in entry && !('site' in entry)) {
        return normalizeStructuredFlow(entry, siteKey);
      }
      return normalizeFlatFlow(entry, siteKey);
    })
    .filter((item): item is StructuredFlowRecord => Boolean(item));

  const hidden = rawHidden
    .map((entry) => {
      if (isRecord(entry) && 'siteKey' in entry && !('site' in entry)) {
        return normalizeStructuredHidden(entry, siteKey);
      }
      return normalizeFlatHidden(entry, siteKey);
    })
    .filter((item): item is StructuredHiddenRecord => Boolean(item));

  return { elements, flows, hidden };
};

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (!isRecord(value)) {
    return value;
  }
  const next: JsonRecord = {};
  Object.keys(value)
    .sort()
    .forEach((key) => {
      next[key] = sortValue(value[key]);
    });
  return next;
};

const stableStringify = (value: unknown) => JSON.stringify(sortValue(value));

export const normalizeStructuredStoragePayload = (
  raw: unknown,
): { payload: StructuredStoragePayload; changed: boolean } => {
  const rawPayload = isRecord(raw) ? raw : {};
  const rawSites = isRecord(rawPayload.sites) ? rawPayload.sites : {};
  const normalizedSites: Record<string, StructuredSiteData> = {};

  Object.entries(rawSites).forEach(([rawSiteKey, rawSiteData]) => {
    const siteKey = deriveSiteKey(rawSiteKey) || rawSiteKey.trim();
    if (!siteKey) {
      return;
    }
    normalizedSites[siteKey] = normalizeSiteDataToStructured(siteKey, rawSiteData);
  });

  const payload: StructuredStoragePayload = { sites: normalizedSites };
  const changed = stableStringify({ sites: rawSites }) !== stableStringify(payload);
  return { payload, changed };
};
