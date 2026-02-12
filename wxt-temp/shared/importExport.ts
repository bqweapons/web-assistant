import { normalizeFlowSteps } from './flowStepMigration';
import {
  buildDefaultSiteUrl,
  deriveSiteKey,
  type StructuredSiteData,
} from './siteDataSchema';
import { normalizeStructuredStoragePayload } from './siteDataMigration';
import {
  countSitesData,
  formatCustomCss,
  isRecord,
  normalizeStringRecord,
  parseTimestamp,
  stableStringify,
} from './siteDataUtils';

const CANONICAL_EXPORT_VERSION = '1.0.2';
export const EXPORT_JSON_VERSION = CANONICAL_EXPORT_VERSION;
const COMPATIBLE_IMPORT_VERSIONS = new Set<string>([EXPORT_JSON_VERSION]);

type JsonRecord = Record<string, unknown>;

export type ExportPayload = {
  version: typeof EXPORT_JSON_VERSION;
  sites: Record<string, StructuredSiteData>;
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
  sites: Record<string, StructuredSiteData>;
  summary: ImportSummary;
};

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

const resolveLegacyPageKey = (pageUrl: string, scope: 'page' | 'site' | 'global', siteKey: string) => {
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
      const host = deriveSiteKey(parsed.host || parsed.hostname || siteKey);
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
    const normalizedHost = deriveSiteKey(withoutQuery) || deriveSiteKey(siteKey) || siteKey;
    return normalizedHost ? `${normalizedHost}/` : null;
  }
  const normalizedHost =
    deriveSiteKey(withoutQuery.slice(0, slashIndex)) || deriveSiteKey(siteKey) || siteKey;
  const pathRaw = withoutQuery.slice(slashIndex);
  const path = pathRaw ? `/${pathRaw.replace(/^\/+/, '')}` : '/';
  return normalizedHost ? `${normalizedHost}${path}` : path;
};

const isLegacyRootUrlWithoutTrailingSlash = (value: string, expectedSiteKey: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.endsWith('/')) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'file:') {
      return false;
    }
    if (parsed.search || parsed.hash) {
      return false;
    }
    const path = parsed.pathname || '/';
    if (path !== '/' && path !== '') {
      return false;
    }
    const host = deriveSiteKey(parsed.host || parsed.hostname || expectedSiteKey);
    return Boolean(host) && host === expectedSiteKey;
  } catch {
    return false;
  }
};

const resolveLegacyImportedScope = (
  rawScope: unknown,
  rawPageUrl: unknown,
  normalizedSiteKey: string,
): 'page' | 'site' | 'global' => {
  if (rawScope === 'site' || rawScope === 'global' || rawScope === 'page') {
    return rawScope;
  }
  if (
    typeof rawPageUrl === 'string' &&
    isLegacyRootUrlWithoutTrailingSlash(rawPageUrl, normalizedSiteKey)
  ) {
    return 'site';
  }
  return 'page';
};

const normalizeImportedElement = (
  raw: unknown,
  siteKey: string,
  fallbackSiteUrl: string,
): StructuredSiteData['elements'][number] | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const now = Date.now();
  const type = isElementType(raw.type) ? raw.type : 'button';
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createId('element-import');
  const siteUrl =
    typeof raw.siteUrl === 'string' && raw.siteUrl.trim() ? raw.siteUrl.trim() : fallbackSiteUrl;
  const normalizedSiteKey = deriveSiteKey(siteUrl) || siteKey;
  const scope = resolveLegacyImportedScope(raw.scope, raw.pageUrl, normalizedSiteKey);
  const pageUrl =
    typeof raw.pageUrl === 'string' && raw.pageUrl.trim() ? raw.pageUrl.trim() : siteUrl || fallbackSiteUrl;
  const frameUrl =
    typeof raw.frameUrl === 'string' && raw.frameUrl.trim() ? raw.frameUrl.trim() : pageUrl;
  const frameSelectors = Array.isArray(raw.frameSelectors)
    ? raw.frameSelectors.filter((item): item is string => typeof item === 'string')
    : [];
  const floating = typeof raw.floating === 'boolean' ? raw.floating : type === 'area';
  const containerId =
    typeof raw.containerId === 'string' && raw.containerId.trim() && raw.containerId.trim() !== id
      ? raw.containerId.trim()
      : undefined;
  const style = normalizeStyle(raw.style, raw.stylePreset, raw.customCss);

  return {
    id,
    text: typeof raw.text === 'string' ? raw.text : '',
    scope,
    context: {
      siteKey: normalizedSiteKey,
      pageKey: resolveLegacyPageKey(pageUrl, scope, normalizedSiteKey),
      frame:
        frameSelectors.length > 0 || frameUrl !== pageUrl
          ? {
              url: frameUrl,
              selectors: frameSelectors,
            }
          : null,
    },
    placement: {
      mode: containerId ? 'container' : floating ? 'floating' : 'dom',
      selector: typeof raw.selector === 'string' ? raw.selector : '',
      position: isElementPosition(raw.position) ? raw.position : 'append',
      relativeTo: {
        before: typeof raw.beforeSelector === 'string' ? raw.beforeSelector : undefined,
        after: typeof raw.afterSelector === 'string' ? raw.afterSelector : undefined,
      },
      containerId,
    },
    style,
    behavior: {
      type,
      href: typeof raw.href === 'string' ? raw.href : undefined,
      target: raw.linkTarget === 'same-tab' ? 'same-tab' : raw.linkTarget === 'new-tab' ? 'new-tab' : undefined,
      actionSelector: typeof raw.actionSelector === 'string' ? raw.actionSelector : undefined,
      actionFlowId:
        typeof raw.actionFlowId === 'string' && raw.actionFlowId.trim() ? raw.actionFlowId.trim() : undefined,
      actionFlowLocked: typeof raw.actionFlowLocked === 'boolean' ? raw.actionFlowLocked : undefined,
      layout: raw.layout === 'column' ? 'column' : raw.layout === 'row' ? 'row' : undefined,
      tooltipPosition:
        raw.tooltipPosition === 'top' ||
        raw.tooltipPosition === 'right' ||
        raw.tooltipPosition === 'bottom' ||
        raw.tooltipPosition === 'left'
          ? raw.tooltipPosition
          : undefined,
      tooltipPersistent: typeof raw.tooltipPersistent === 'boolean' ? raw.tooltipPersistent : undefined,
    },
    createdAt: parseTimestamp(raw.createdAt, now),
    updatedAt: parseTimestamp(raw.updatedAt, now),
  };
};

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

type LegacySiteData = {
  elements: StructuredSiteData['elements'];
  flows: StructuredSiteData['flows'];
  hidden: StructuredSiteData['hidden'];
};

const buildLegacySiteData = (
  bucketKey: string,
  entries: unknown[],
  warnings: string[],
): [string, LegacySiteData] | null => {
  const siteKey = resolveLegacySiteKey(bucketKey, entries);
  if (!siteKey) {
    warnings.push(`Skipped legacy site bucket "${bucketKey}" because the site key could not be resolved.`);
    return null;
  }
  const fallbackSiteUrl =
    (typeof bucketKey === 'string' && bucketKey.trim() ? bucketKey.trim() : '') || buildDefaultSiteUrl(siteKey);
  const elements: StructuredSiteData['elements'] = [];
  const flows: StructuredSiteData['flows'] = [];
  const signatureToFlowId = new Map<string, string>();
  const usedFlowIds = new Set<string>();

  entries.forEach((entry, index) => {
    const element = normalizeImportedElement(entry, siteKey, fallbackSiteUrl);
    if (!element) {
      return;
    }
    elements.push(element);

    if (element.behavior.type !== 'button') {
      return;
    }
    const legacyActionFlow =
      isRecord(entry) && typeof entry.actionFlow === 'string'
        ? entry.actionFlow
        : isRecord(entry) && isRecord(entry.behavior) && typeof entry.behavior.actionFlow === 'string'
          ? entry.behavior.actionFlow
          : '';
    const parsed = parseLegacyActionFlow(legacyActionFlow);
    if (!parsed) {
      if (legacyActionFlow.trim()) {
        warnings.push(`Skipped invalid actionFlow on element "${String(element.id)}" in site "${siteKey}".`);
      }
      return;
    }

    const existingBySignature = signatureToFlowId.get(parsed.signature);
    if (existingBySignature) {
      element.behavior.actionFlowId = existingBySignature;
      return;
    }

    const preferredId =
      typeof element.behavior.actionFlowId === 'string' && element.behavior.actionFlowId.trim()
        ? element.behavior.actionFlowId.trim()
        : `flow-import-${hashString(`${siteKey}:${parsed.signature}`)}`;
    const flowId = ensureUniqueFlowId(preferredId, usedFlowIds);
    signatureToFlowId.set(parsed.signature, flowId);
    element.behavior.actionFlowId = flowId;

    const flowNameSource = typeof element.text === 'string' ? element.text.trim() : '';
    const updatedAt = parseTimestamp(element.updatedAt, Date.now());
    flows.push({
      id: flowId,
      name: flowNameSource ? `Imported flow - ${flowNameSource}` : `Imported flow ${index + 1}`,
      description: 'Generated from legacy actionFlow.',
      scope: 'site',
      siteKey,
      pageKey: null,
      steps: (() => {
        const normalized = normalizeFlowSteps(parsed.steps, {
          flowId,
          keepNumber: false,
          sanitizeExisting: true,
          idFactory: createId,
        });
        return Array.isArray(normalized) ? normalized : [];
      })(),
      updatedAt,
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

const normalizeSitesObject = (rawSites: Record<string, unknown>) =>
  normalizeStructuredStoragePayload({ sites: rawSites }).payload.sites;

const buildParsedResultFromSites = (
  sites: Record<string, StructuredSiteData>,
  sourceVersion: string,
  warnings: string[],
): ParsedImportPayload => {
  const summary = countSitesData(sites);
  return {
    sites,
    summary: {
      sourceVersion,
      ...summary,
      warnings,
    },
  };
};

const parseVersionedPayload = (raw: JsonRecord): ParsedImportPayload => {
  const version = typeof raw.version === 'string' ? raw.version : '';
  if (!isRecord(raw.sites)) {
    throw new Error('Invalid import payload: "sites" must be an object.');
  }
  const warnings: string[] = [];
  if (!COMPATIBLE_IMPORT_VERSIONS.has(version)) {
    warnings.push(`Imported unknown payload version "${version}" using compatibility normalization.`);
  }
  const sites = normalizeSitesObject(raw.sites);
  return buildParsedResultFromSites(sites, version, warnings);
};

const parseUnversionedSitesPayload = (raw: JsonRecord): ParsedImportPayload => {
  if (!isRecord(raw.sites)) {
    throw new Error('Invalid import payload: "sites" must be an object.');
  }
  const sites = normalizeSitesObject(raw.sites);
  return buildParsedResultFromSites(sites, 'unversioned', [
    'Imported unversioned payload and normalized to canonical schema.',
  ]);
};

const parseLegacyPayload = (raw: Record<string, unknown[]>): ParsedImportPayload => {
  const legacySites: Record<string, LegacySiteData> = {};
  const warnings: string[] = [];

  Object.entries(raw).forEach(([bucketKey, entries]) => {
    const normalized = buildLegacySiteData(bucketKey, entries, warnings);
    if (!normalized) {
      return;
    }
    const [siteKey, siteData] = normalized;
    legacySites[siteKey] = siteData;
  });

  const sites = normalizeSitesObject(legacySites);
  return buildParsedResultFromSites(sites, 'legacy', warnings);
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const getItemId = (value: unknown) => {
  if (!isRecord(value)) {
    return '';
  }
  return typeof value.id === 'string' ? value.id : '';
};

const mergeById = <T>(currentList: T[], incomingList: T[]) => {
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
    return parseTimestamp(value.updatedAt, 0);
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

export const buildExportPayload = (sites: Record<string, StructuredSiteData>): ExportPayload => {
  const normalizedSites = normalizeStructuredStoragePayload({ sites: sites || {} }).payload.sites;
  return {
    version: EXPORT_JSON_VERSION,
    sites: normalizedSites,
  };
};

export const parseImportPayload = (raw: unknown): ParsedImportPayload => {
  if (isRecord(raw) && typeof raw.version !== 'undefined') {
    return parseVersionedPayload(raw);
  }
  if (isRecord(raw) && isRecord(raw.sites)) {
    return parseUnversionedSitesPayload(raw);
  }
  if (isLegacyPayload(raw)) {
    return parseLegacyPayload(raw);
  }
  throw new Error('Invalid import payload format.');
};

export const mergeSitesData = (
  currentSites: Record<string, StructuredSiteData>,
  incomingSites: Record<string, StructuredSiteData>,
): Record<string, StructuredSiteData> => {
  const merged: Record<string, StructuredSiteData> = { ...currentSites };
  Object.entries(incomingSites).forEach(([siteKey, incomingSite]) => {
    const existing = currentSites[siteKey];
    if (!existing) {
      merged[siteKey] = {
        elements: asArray<StructuredSiteData['elements'][number]>(incomingSite.elements),
        flows: asArray<StructuredSiteData['flows'][number]>(incomingSite.flows),
        hidden: asArray<StructuredSiteData['hidden'][number]>(incomingSite.hidden),
      };
      return;
    }
    merged[siteKey] = {
      elements: mergeById(
        asArray<StructuredSiteData['elements'][number]>(existing.elements),
        asArray<StructuredSiteData['elements'][number]>(incomingSite.elements),
      ),
      flows: mergeById(
        asArray<StructuredSiteData['flows'][number]>(existing.flows),
        asArray<StructuredSiteData['flows'][number]>(incomingSite.flows),
      ),
      hidden: mergeById(
        asArray<StructuredSiteData['hidden'][number]>(existing.hidden),
        asArray<StructuredSiteData['hidden'][number]>(incomingSite.hidden),
      ),
    };
  });
  return merged;
};
