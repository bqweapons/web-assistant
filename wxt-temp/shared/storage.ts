import {
  deriveSiteKey,
  type StructuredSiteData,
  type StructuredStoragePayload,
} from './siteDataSchema';
import { normalizeStructuredStoragePayload } from './siteDataMigration';

export const STORAGE_KEY = 'ladybird_sites';

export type SiteData = StructuredSiteData;

export type StoragePayload = StructuredStoragePayload;

const EMPTY_SITE_DATA: SiteData = { elements: [], flows: [], hidden: [] };
let writeQueue: Promise<void> = Promise.resolve();

const enqueueWrite = async <T>(operation: () => Promise<T>): Promise<T> => {
  const run = writeQueue.then(operation, operation);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

const getLocalStorage = () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  return null;
};

const writeStructuredPayload = async (payload: StructuredStoragePayload) => {
  const storage = getLocalStorage();
  if (storage) {
    await storage.set({ [STORAGE_KEY]: payload });
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
};

const readStructuredPayload = async (): Promise<StructuredStoragePayload> => {
  const storage = getLocalStorage();
  if (storage) {
    const result = await storage.get(STORAGE_KEY);
    const rawPayload = result?.[STORAGE_KEY] as unknown;
    const normalized = normalizeStructuredStoragePayload(rawPayload);
    if (normalized.changed) {
      await writeStructuredPayload(normalized.payload);
    }
    return normalized.payload;
  }
  try {
    const rawText = localStorage.getItem(STORAGE_KEY);
    const parsed = rawText ? (JSON.parse(rawText) as unknown) : { sites: {} };
    const normalized = normalizeStructuredStoragePayload(parsed);
    if (normalized.changed) {
      await writeStructuredPayload(normalized.payload);
    }
    return normalized.payload;
  } catch {
    return { sites: {} };
  }
};

export const getSiteData = async (siteKey: string): Promise<SiteData> => {
  const payload = await readStructuredPayload();
  const normalizedSiteKey = deriveSiteKey(siteKey) || siteKey.trim();
  const siteData = payload.sites?.[normalizedSiteKey];
  if (!siteData) {
    return EMPTY_SITE_DATA;
  }
  return {
    elements: Array.isArray(siteData.elements) ? siteData.elements : [],
    flows: Array.isArray(siteData.flows) ? siteData.flows : [],
    hidden: Array.isArray(siteData.hidden) ? siteData.hidden : [],
  };
};

export const getAllSitesData = async (): Promise<Record<string, SiteData>> => {
  const payload = await readStructuredPayload();
  const next: Record<string, SiteData> = {};
  Object.entries(payload.sites || {}).forEach(([siteKey, siteData]) => {
    next[siteKey] = {
      elements: Array.isArray(siteData.elements) ? siteData.elements : [],
      flows: Array.isArray(siteData.flows) ? siteData.flows : [],
      hidden: Array.isArray(siteData.hidden) ? siteData.hidden : [],
    };
  });
  return next;
};

export const setSiteData = async (siteKey: string, data: Partial<SiteData>) => {
  const normalizedSiteKey = deriveSiteKey(siteKey) || siteKey.trim();
  if (!normalizedSiteKey) {
    return;
  }
  await enqueueWrite(async () => {
    const payload = await readStructuredPayload();
    const current = payload.sites?.[normalizedSiteKey] || {
      elements: [],
      flows: [],
      hidden: [],
    };
    const raw = {
      sites: {
        ...(payload.sites || {}),
        [normalizedSiteKey]: {
          elements: data.elements ?? current.elements,
          flows: data.flows ?? current.flows,
          hidden: data.hidden ?? current.hidden,
        },
      },
    };
    const normalized = normalizeStructuredStoragePayload(raw);
    await writeStructuredPayload(normalized.payload);
  });
};

export const setAllSitesData = async (sites: Record<string, SiteData>) => {
  await enqueueWrite(async () => {
    const normalized = normalizeStructuredStoragePayload({ sites: sites || {} });
    await writeStructuredPayload(normalized.payload);
  });
};
