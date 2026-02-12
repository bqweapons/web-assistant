import type { SiteData } from './storage';
import { normalizeFlowSteps } from './flowStepMigration';

export const EXPORT_JSON_VERSION = '1.0.2';

type JsonRecord = Record<string, unknown>;

export type ExportPayload = {
  version: typeof EXPORT_JSON_VERSION;
  sites: Record<string, SiteData>;
};

export type ImportSummary = {
  sourceVersion: string;
  siteCount: number;
  elementCount: number;
  flowCount: number;
  hiddenCount: number;
  warnings: string[];
};

export type ParsedImportPayload = {
  sites: Record<string, SiteData>;
  summary: ImportSummary;
};

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeSiteKey = (value: string) =>
  value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');

const deriveSiteKey = (input: string) => {
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

const buildDefaultSiteUrl = (siteKey: string) => {
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

const toKebabCase = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

const formatCustomCss = (rules: Record<string, string>) =>
  Object.entries(rules)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => Boolean(key) && Boolean(value))
    .map(([key, value]) => `${toKebabCase(key)}: ${value};`)
    .join('\n');

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isElementType = (value: unknown): value is 'button' | 'link' | 'tooltip' | 'area' =>
  value === 'button' || value === 'link' || value === 'tooltip' || value === 'area';

const isElementPosition = (value: unknown): value is 'append' | 'prepend' | 'before' | 'after' =>
  value === 'append' || value === 'prepend' || value === 'before' || value === 'after';

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

const normalizeStyle = (
  rawStyle: unknown,
  legacyPreset?: unknown,
  legacyCustomCss?: unknown,
): { preset?: string; inline: Record<string, string>; customCss: string } => {
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
  const customCss = typeof legacyCustomCss === 'string' ? legacyCustomCss : formatCustomCss(inline);
  return {
    preset: typeof legacyPreset === 'string' ? legacyPreset : undefined,
    inline,
    customCss,
  };
};

const normalizeImportedElement = (raw: unknown, siteKey: string, fallbackSiteUrl: string): JsonRecord | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const now = Date.now();
  const type = isElementType(raw.type) ? raw.type : 'button';
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createId('element-import');
  const siteUrl =
    typeof raw.siteUrl === 'string' && raw.siteUrl.trim() ? raw.siteUrl.trim() : fallbackSiteUrl;
  const pageUrl =
    typeof raw.pageUrl === 'string' && raw.pageUrl.trim() ? raw.pageUrl.trim() : siteUrl || fallbackSiteUrl;
  const frameUrl =
    typeof raw.frameUrl === 'string' && raw.frameUrl.trim() ? raw.frameUrl.trim() : pageUrl;
  const frameSelectors = Array.isArray(raw.frameSelectors)
    ? raw.frameSelectors.filter((item): item is string => typeof item === 'string')
    : [];
  const normalized: JsonRecord = {
    ...raw,
    id,
    type,
    text: typeof raw.text === 'string' ? raw.text : '',
    selector: typeof raw.selector === 'string' ? raw.selector : '',
    position: isElementPosition(raw.position) ? raw.position : 'append',
    style: normalizeStyle(raw.style, raw.stylePreset, raw.customCss),
    pageUrl,
    siteUrl,
    frameUrl,
    frameSelectors,
    floating: typeof raw.floating === 'boolean' ? raw.floating : type === 'area',
    scope: raw.scope === 'site' || raw.scope === 'global' ? raw.scope : 'page',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
  };

  if (typeof raw.beforeSelector !== 'string') {
    delete normalized.beforeSelector;
  }
  if (typeof raw.afterSelector !== 'string') {
    delete normalized.afterSelector;
  }
  if (typeof raw.containerId === 'string' && raw.containerId.trim() && raw.containerId.trim() !== id) {
    normalized.containerId = raw.containerId.trim();
  } else {
    delete normalized.containerId;
  }
  if (typeof raw.layout !== 'string') {
    delete normalized.layout;
  }
  if (typeof raw.href !== 'string') {
    delete normalized.href;
  }
  if (raw.linkTarget !== 'same-tab' && raw.linkTarget !== 'new-tab') {
    delete normalized.linkTarget;
  }
  if (raw.tooltipPosition !== 'top' && raw.tooltipPosition !== 'right' && raw.tooltipPosition !== 'bottom' && raw.tooltipPosition !== 'left') {
    delete normalized.tooltipPosition;
  }
  if (typeof raw.tooltipPersistent !== 'boolean') {
    delete normalized.tooltipPersistent;
  }
  if (typeof raw.actionFlowId !== 'string' || !raw.actionFlowId.trim()) {
    delete normalized.actionFlowId;
  } else {
    normalized.actionFlowId = raw.actionFlowId.trim();
  }
  if (typeof raw.actionFlowLocked !== 'boolean') {
    delete normalized.actionFlowLocked;
  }
  if (typeof raw.actionFlow !== 'string' || !raw.actionFlow.trim()) {
    delete normalized.actionFlow;
  } else {
    normalized.actionFlow = raw.actionFlow;
  }

  delete normalized.stylePreset;
  delete normalized.customCss;

  return normalized;
};

const formatFlowTimestamp = (value: number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '1970-01-01 00:00:00';
  }
  const pad = (segment: number) => String(segment).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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

const hashString = (input: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
};

const parseLegacyActionFlow = (value: unknown): { steps: unknown[]; signature: string } | null => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.steps)) {
      return null;
    }
    return {
      steps: parsed.steps,
      signature: stableStringify(parsed.steps),
    };
  } catch {
    return null;
  }
};

const ensureUniqueFlowId = (preferredId: string, usedIds: Set<string>) => {
  const baseId = preferredId || createId('flow-import');
  let nextId = baseId;
  let suffix = 2;
  while (usedIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(nextId);
  return nextId;
};

const normalizeImportedFlow = (raw: unknown, siteKey: string): JsonRecord | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createId('flow-import');
  const updatedAt =
    typeof raw.updatedAt === 'string'
      ? raw.updatedAt
      : typeof raw.updatedAt === 'number'
        ? formatFlowTimestamp(raw.updatedAt)
        : formatFlowTimestamp(Date.now());
  const steps = normalizeFlowSteps(raw.steps, {
    flowId: id,
    keepNumber: true,
    sanitizeExisting: true,
    idFactory: createId,
  });
  const normalized: JsonRecord = {
    ...raw,
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Imported flow',
    description: typeof raw.description === 'string' ? raw.description : '',
    site: typeof raw.site === 'string' && raw.site.trim() ? raw.site.trim() : siteKey,
    steps,
    updatedAt,
  };
  delete normalized.scope;
  delete normalized.siteKey;
  return normalized;
};

const normalizeImportedHiddenRule = (raw: unknown, siteKey: string): JsonRecord | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createId('hidden-import');
  const updatedAt =
    typeof raw.updatedAt === 'string'
      ? raw.updatedAt
      : typeof raw.updatedAt === 'number'
        ? formatFlowTimestamp(raw.updatedAt)
        : formatFlowTimestamp(Date.now());
  return {
    ...raw,
    id,
    site: typeof raw.site === 'string' && raw.site.trim() ? raw.site.trim() : siteKey,
    selector: typeof raw.selector === 'string' ? raw.selector : '',
    updatedAt,
  };
};

const resolveLegacySiteKey = (bucketKey: string, entries: unknown[]) => {
  const fromKey = deriveSiteKey(bucketKey);
  if (fromKey) {
    return fromKey;
  }
  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue;
    }
    const fromSiteUrl = typeof entry.siteUrl === 'string' ? deriveSiteKey(entry.siteUrl) : '';
    if (fromSiteUrl) {
      return fromSiteUrl;
    }
    const fromPageUrl = typeof entry.pageUrl === 'string' ? deriveSiteKey(entry.pageUrl) : '';
    if (fromPageUrl) {
      return fromPageUrl;
    }
  }
  return '';
};

const buildLegacySiteData = (bucketKey: string, entries: unknown[], warnings: string[]): [string, SiteData] | null => {
  const siteKey = resolveLegacySiteKey(bucketKey, entries);
  if (!siteKey) {
    warnings.push(`Skipped legacy site bucket "${bucketKey}" because the site key could not be resolved.`);
    return null;
  }
  const fallbackSiteUrl =
    (typeof bucketKey === 'string' && bucketKey.trim() ? bucketKey.trim() : '') || buildDefaultSiteUrl(siteKey);
  const elements = entries
    .map((entry) => normalizeImportedElement(entry, siteKey, fallbackSiteUrl))
    .filter((item): item is JsonRecord => Boolean(item));

  const flows: JsonRecord[] = [];
  const signatureToFlowId = new Map<string, string>();
  const usedFlowIds = new Set<string>();

  elements.forEach((element, index) => {
    if (element.type !== 'button') {
      return;
    }
    const parsed = parseLegacyActionFlow(element.actionFlow);
    if (!parsed) {
      if (typeof element.actionFlow === 'string' && element.actionFlow.trim()) {
        warnings.push(`Skipped invalid actionFlow on element "${String(element.id)}" in site "${siteKey}".`);
      }
      return;
    }

    const existingBySignature = signatureToFlowId.get(parsed.signature);
    if (existingBySignature) {
      element.actionFlowId = existingBySignature;
      return;
    }

    const preferredId =
      typeof element.actionFlowId === 'string' && element.actionFlowId.trim()
        ? element.actionFlowId.trim()
        : `flow-import-${hashString(`${siteKey}:${parsed.signature}`)}`;
    const flowId = ensureUniqueFlowId(preferredId, usedFlowIds);
    signatureToFlowId.set(parsed.signature, flowId);
    element.actionFlowId = flowId;

    const flowNameSource = typeof element.text === 'string' ? element.text.trim() : '';
    const updatedAt = typeof element.updatedAt === 'number' ? element.updatedAt : Date.now();
    flows.push({
      id: flowId,
      name: flowNameSource ? `Imported flow - ${flowNameSource}` : `Imported flow ${index + 1}`,
      description: 'Generated from legacy actionFlow.',
      site: siteKey,
      steps: normalizeFlowSteps(parsed.steps, {
        flowId,
        keepNumber: true,
        sanitizeExisting: true,
        idFactory: createId,
      }),
      updatedAt: formatFlowTimestamp(updatedAt),
    });
  });

  return [siteKey, { elements, flows, hidden: [] }];
};

const isLegacyPayload = (raw: unknown): raw is Record<string, unknown[]> => {
  if (!isRecord(raw)) {
    return false;
  }
  return Object.values(raw).every((value) => Array.isArray(value));
};

const parseVersionedPayload = (raw: JsonRecord): ParsedImportPayload => {
  const version = typeof raw.version === 'string' ? raw.version : '';
  if (version !== EXPORT_JSON_VERSION) {
    throw new Error(`Unsupported import version "${String(raw.version)}".`);
  }
  if (!isRecord(raw.sites)) {
    throw new Error('Invalid import payload: "sites" must be an object.');
  }

  const sites: Record<string, SiteData> = {};
  const warnings: string[] = [];
  let elementCount = 0;
  let flowCount = 0;
  let hiddenCount = 0;

  Object.entries(raw.sites).forEach(([rawSiteKey, rawSiteData]) => {
    if (!isRecord(rawSiteData)) {
      throw new Error(`Invalid site payload for "${rawSiteKey}".`);
    }
    const siteKey = deriveSiteKey(rawSiteKey) || rawSiteKey.trim();
    if (!siteKey) {
      warnings.push(`Skipped site "${rawSiteKey}" because the site key is invalid.`);
      return;
    }
    const fallbackSiteUrl =
      (typeof rawSiteData.siteUrl === 'string' && rawSiteData.siteUrl.trim()) || buildDefaultSiteUrl(siteKey);

    const rawElements = Array.isArray(rawSiteData.elements) ? rawSiteData.elements : [];
    const rawFlows = Array.isArray(rawSiteData.flows) ? rawSiteData.flows : [];
    const rawHidden = Array.isArray(rawSiteData.hidden) ? rawSiteData.hidden : [];

    const elements = rawElements
      .map((entry) => normalizeImportedElement(entry, siteKey, fallbackSiteUrl))
      .filter((item): item is JsonRecord => Boolean(item));
    const flows = rawFlows
      .map((entry) => normalizeImportedFlow(entry, siteKey))
      .filter((item): item is JsonRecord => Boolean(item));
    const hidden = rawHidden
      .map((entry) => normalizeImportedHiddenRule(entry, siteKey))
      .filter((item): item is JsonRecord => Boolean(item));

    elementCount += elements.length;
    flowCount += flows.length;
    hiddenCount += hidden.length;
    sites[siteKey] = { elements, flows, hidden };
  });

  return {
    sites,
    summary: {
      sourceVersion: version,
      siteCount: Object.keys(sites).length,
      elementCount,
      flowCount,
      hiddenCount,
      warnings,
    },
  };
};

const parseLegacyPayload = (raw: Record<string, unknown[]>): ParsedImportPayload => {
  const sites: Record<string, SiteData> = {};
  const warnings: string[] = [];
  let elementCount = 0;
  let flowCount = 0;

  Object.entries(raw).forEach(([bucketKey, entries]) => {
    const normalized = buildLegacySiteData(bucketKey, entries, warnings);
    if (!normalized) {
      return;
    }
    const [siteKey, siteData] = normalized;
    elementCount += siteData.elements.length;
    flowCount += siteData.flows.length;
    sites[siteKey] = siteData;
  });

  return {
    sites,
    summary: {
      sourceVersion: 'legacy',
      siteCount: Object.keys(sites).length,
      elementCount,
      flowCount,
      hiddenCount: 0,
      warnings,
    },
  };
};

const asArray = (value: unknown) => (Array.isArray(value) ? value : []);

const getItemId = (value: unknown) => {
  if (!isRecord(value)) {
    return '';
  }
  return typeof value.id === 'string' ? value.id : '';
};

const mergeById = (currentList: unknown[], incomingList: unknown[]) => {
  const merged = [...currentList];
  const idToIndex = new Map<string, number>();
  merged.forEach((item, index) => {
    const id = getItemId(item);
    if (!id || idToIndex.has(id)) {
      return;
    }
    idToIndex.set(id, index);
  });

  const getUpdatedAtTimestamp = (value: unknown) => {
    if (!isRecord(value)) {
      return 0;
    }
    if (typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)) {
      return value.updatedAt;
    }
    if (typeof value.updatedAt === 'string') {
      const numeric = Number(value.updatedAt);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
      }
      const normalized = value.updatedAt.includes(' ')
        ? value.updatedAt.replace(' ', 'T')
        : value.updatedAt;
      const parsed = Date.parse(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return 0;
  };

  incomingList.forEach((item) => {
    const id = getItemId(item);
    if (id && idToIndex.has(id)) {
      const currentIndex = idToIndex.get(id) as number;
      const currentItem = merged[currentIndex];
      const shouldReplace = getUpdatedAtTimestamp(item) >= getUpdatedAtTimestamp(currentItem);
      if (shouldReplace) {
        merged[currentIndex] = item;
      }
      return;
    }
    merged.push(item);
    if (id) {
      idToIndex.set(id, merged.length - 1);
    }
  });

  return merged;
};

export const buildExportPayload = (sites: Record<string, SiteData>): ExportPayload => {
  const normalizedSites: Record<string, SiteData> = {};
  Object.entries(sites || {}).forEach(([rawSiteKey, rawSiteData]) => {
    const siteKey = deriveSiteKey(rawSiteKey) || rawSiteKey.trim();
    if (!siteKey) {
      return;
    }
    const siteData = rawSiteData || { elements: [], flows: [], hidden: [] };
    const fallbackSiteUrl = buildDefaultSiteUrl(siteKey);
    const elements = asArray(siteData.elements)
      .map((entry) => normalizeImportedElement(entry, siteKey, fallbackSiteUrl))
      .filter((item): item is JsonRecord => Boolean(item));
    const flows = asArray(siteData.flows)
      .map((entry) => normalizeImportedFlow(entry, siteKey))
      .filter((item): item is JsonRecord => Boolean(item));
    const hidden = asArray(siteData.hidden)
      .map((entry) => normalizeImportedHiddenRule(entry, siteKey))
      .filter((item): item is JsonRecord => Boolean(item));
    normalizedSites[siteKey] = { elements, flows, hidden };
  });
  return {
    version: EXPORT_JSON_VERSION,
    sites: normalizedSites,
  };
};

export const parseImportPayload = (raw: unknown): ParsedImportPayload => {
  if (isRecord(raw) && typeof raw.version !== 'undefined') {
    return parseVersionedPayload(raw);
  }
  if (isLegacyPayload(raw)) {
    return parseLegacyPayload(raw);
  }
  throw new Error('Invalid import payload format.');
};

export const mergeSitesData = (
  currentSites: Record<string, SiteData>,
  incomingSites: Record<string, SiteData>,
): Record<string, SiteData> => {
  const merged: Record<string, SiteData> = { ...currentSites };
  Object.entries(incomingSites).forEach(([siteKey, incomingSite]) => {
    const existing = currentSites[siteKey];
    if (!existing) {
      merged[siteKey] = {
        elements: asArray(incomingSite.elements),
        flows: asArray(incomingSite.flows),
        hidden: asArray(incomingSite.hidden),
      };
      return;
    }
    merged[siteKey] = {
      elements: mergeById(asArray(existing.elements), asArray(incomingSite.elements)),
      flows: mergeById(asArray(existing.flows), asArray(incomingSite.flows)),
      hidden: mergeById(asArray(existing.hidden), asArray(incomingSite.hidden)),
    };
  });
  return merged;
};
