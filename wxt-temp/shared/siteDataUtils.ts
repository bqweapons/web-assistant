import type { StructuredSiteData } from './siteDataSchema';

type JsonRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeStringRecord = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) {
    return {};
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

export const toKebabCase = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

export const formatCustomCss = (rules: Record<string, string>) =>
  Object.entries(rules)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => Boolean(key) && Boolean(value))
    .map(([key, value]) => `${toKebabCase(key)}: ${value};`)
    .join('\n');

export const parseTimestamp = (value: unknown, fallback: number): number => {
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
  return fallback;
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

export const stableStringify = (value: unknown): string => JSON.stringify(sortValue(value));

export const countSitesData = (
  sites: Record<string, StructuredSiteData>,
): { siteCount: number; elementCount: number; flowCount: number; hiddenCount: number } => {
  let elementCount = 0;
  let flowCount = 0;
  let hiddenCount = 0;

  Object.values(sites).forEach((siteData) => {
    elementCount += Array.isArray(siteData.elements) ? siteData.elements.length : 0;
    flowCount += Array.isArray(siteData.flows) ? siteData.flows.length : 0;
    hiddenCount += Array.isArray(siteData.hidden) ? siteData.hidden.length : 0;
  });

  return {
    siteCount: Object.keys(sites).length,
    elementCount,
    flowCount,
    hiddenCount,
  };
};
