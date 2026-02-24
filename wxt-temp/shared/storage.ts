import {
  deriveSiteKey,
  type StructuredSiteData,
  type StructuredStoragePayload,
} from './siteDataSchema';
import { mergeSitesData, parseImportPayload } from './importExport';
import { normalizeStructuredStoragePayload } from './siteDataMigration';

export const STORAGE_KEY = 'ladybird_sites';
// Legacy auto-migration (old extension -> new extension).
// To disable automatic legacy detection + migration in a future version, remove:
// 1) `LEGACY_STORAGE_KEY` and `LEGACY_MIGRATION_FLAG_KEY`
// 2) `isRecord` and `tryMigrateLegacyPayload`
// 3) The legacy migration branches inside `readStructuredPayload` (both chrome.storage and localStorage paths)
const LEGACY_STORAGE_KEY = 'injectedElements';
const LEGACY_MIGRATION_FLAG_KEY = 'ladybird_legacy_migrated_v1';

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// One-time legacy payload migration helper.
// Safe removal target when retiring old-data compatibility.
const tryMigrateLegacyPayload = (
  currentPayload: StructuredStoragePayload,
  legacyRaw: unknown,
): StructuredStoragePayload | null => {
  if (!isRecord(legacyRaw)) {
    return null;
  }
  try {
    const parsed = parseImportPayload(legacyRaw);
    const mergedSites = mergeSitesData(currentPayload.sites || {}, parsed.sites || {});
    const normalized = normalizeStructuredStoragePayload({ sites: mergedSites });
    return normalized.payload;
  } catch (error) {
    console.warn('legacy-site-migration-failed', error);
    return null;
  }
};

const writeStructuredPayload = async (payload: StructuredStoragePayload) => {
  const storage = getLocalStorage();
  if (storage) {
    await storage.set({ [STORAGE_KEY]: payload });
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('site-load-failed', error);
  }
};

const readStructuredPayload = async (): Promise<StructuredStoragePayload> => {
  const storage = getLocalStorage();
  if (storage) {
    const result = await storage.get([STORAGE_KEY, LEGACY_STORAGE_KEY, LEGACY_MIGRATION_FLAG_KEY]);
    const rawPayload = result?.[STORAGE_KEY] as unknown;
    const normalized = normalizeStructuredStoragePayload(rawPayload);
    if (normalized.changed) {
      await writeStructuredPayload(normalized.payload);
    }
    // Legacy auto-detect + auto-migrate (chrome.storage path).
    // Delete this whole block to stop automatic migration from `injectedElements`.
    const legacyMigrationDone = result?.[LEGACY_MIGRATION_FLAG_KEY] === true;
    if (!legacyMigrationDone && typeof result?.[LEGACY_STORAGE_KEY] !== 'undefined') {
      const migrated = tryMigrateLegacyPayload(normalized.payload, result?.[LEGACY_STORAGE_KEY]);
      if (migrated) {
        await storage.set({
          [STORAGE_KEY]: migrated,
          [LEGACY_MIGRATION_FLAG_KEY]: true,
        });
        return migrated;
      }
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
    // Legacy auto-detect + auto-migrate (localStorage fallback path).
    // Delete this whole block to stop automatic migration from legacy localStorage data.
    const legacyMigrationDone = localStorage.getItem(LEGACY_MIGRATION_FLAG_KEY) === '1';
    const legacyRawText = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyMigrationDone && legacyRawText) {
      let legacyParsed: unknown = null;
      try {
        legacyParsed = JSON.parse(legacyRawText);
      } catch (error) {
        console.warn('legacy-site-migration-parse-failed', error);
      }
      const migrated = tryMigrateLegacyPayload(normalized.payload, legacyParsed);
      if (migrated) {
        await writeStructuredPayload(migrated);
        localStorage.setItem(LEGACY_MIGRATION_FLAG_KEY, '1');
        return migrated;
      }
    }
    return normalized.payload;
  } catch (error) {
    console.warn('site-load-failed', error);
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
