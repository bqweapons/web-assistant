// 1.14 — `shared/storage.ts` is now READ-ONLY from non-SW realms. Writes
// (including normalization writebacks and legacy-migration flag flips)
// have been moved to `entrypoints/background/siteStorage.ts` (SW-only).
// Sidepanel write callers use `shared/siteStorageClient.ts`, which sends
// `SITES_SET_*` messages to the SW.
//
// Why this split: `chrome.storage.local` is shared across realms, but the
// JS-level `writeQueue` lived per-realm (each V8 isolate loaded the module
// independently). Two concurrent writers from different realms could race
// on the whole-document `storage.set({ [SITE_DATA_STORAGE_KEY]: ... })`,
// producing last-write-wins data loss. `navigator.locks` can't coordinate
// this because content scripts run in the host page's origin while
// sidepanel/SW run in `chrome-extension://`; locks are origin-scoped and
// don't see each other across origins. The only structural fix is to
// strip write capability from every realm except the SW.
//
// Reads normalize in memory and return; they never persist back to disk.
// If the stored data needs tidying (normalization changed) or if legacy
// v1 data is detected, the caller gets the normalized/migrated view for
// this read, but the on-disk bytes aren't updated. Persistence happens:
//   1. On SW cold-start via `primeSiteStoragePersistence` (bootstrap.ts)
//   2. On any sidepanel-initiated write via `SITES_SET_*` messages
// Both paths run inside `siteStorage.ts`'s write queue.
//
// `StorageQuotaExceededError` and `CORRUPT_BACKUP_KEY` are exported so
// the SW-side writer can share the same types/constants without duplicating
// them; the quota-detection logic itself is duplicated in siteStorage.ts
// to keep this file dependency-free for non-SW surfaces.

import {
  deriveSiteKey,
  type StructuredSiteData,
  type StructuredStoragePayload,
} from './siteDataSchema';
import { ensureLegacyAutoAdsMigration } from './globalSettings';
import { mergeSitesData, parseImportPayload } from './importExport';
import { normalizeStructuredStoragePayload } from './siteDataMigration';
import { SITE_DATA_STORAGE_KEY } from './storageKeys';

export const STORAGE_KEY = SITE_DATA_STORAGE_KEY;

// Legacy auto-migration constants. These are read-only here (flag check +
// in-memory migration only); the flag flip and the persistence of the
// migrated payload happen in SW siteStorage.ts.
const LEGACY_STORAGE_KEY = 'injectedElements';
const LEGACY_MIGRATION_FLAG_KEY = 'ladybird_legacy_migrated_v1';
// Exported so SW siteStorage.ts can back up corrupt local-storage bytes
// under the same key (single source of truth for the key string).
export const CORRUPT_BACKUP_KEY = 'ladybird_sites__corrupt_backup';

export type SiteData = StructuredSiteData;
export type StoragePayload = StructuredStoragePayload;

export class StorageQuotaExceededError extends Error {
  readonly code = 'storage-quota-exceeded' as const;
  constructor(public readonly cause?: unknown) {
    super('storage quota exceeded');
    this.name = 'StorageQuotaExceededError';
  }
}

const EMPTY_SITE_DATA: SiteData = { elements: [], flows: [], hidden: [] };

const getLocalStorage = () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// 1.14 — Purely in-memory legacy migration for non-SW reads. Doesn't
// write anything. Returns the migrated payload (or the untouched payload
// if no legacy data present or if the migration flag is already set).
const maybeApplyLegacyInMemory = (
  currentPayload: StructuredStoragePayload,
  legacyRaw: unknown,
): StructuredStoragePayload => {
  if (!isRecord(legacyRaw)) {
    return currentPayload;
  }
  try {
    const parsed = parseImportPayload(legacyRaw);
    const mergedSites = mergeSitesData(currentPayload.sites || {}, parsed.sites || {});
    const normalized = normalizeStructuredStoragePayload({ sites: mergedSites });
    return normalized.payload;
  } catch (error) {
    console.warn('legacy-site-migration-in-memory-failed', error);
    return currentPayload;
  }
};

// 1.14 — READ-ONLY. Non-SW realms (sidepanel, content script) get the
// same view of the data as the SW would produce (normalization applied,
// legacy data folded in), but this function never persists anything.
// Compare with `readStructuredPayloadLocked` in siteStorage.ts, which
// performs the same logical reads but also writes back tidy/migrated
// payload (and must be called inside the SW writer queue).
const readStructuredPayload = async (): Promise<StructuredStoragePayload> => {
  const storage = getLocalStorage();
  if (storage) {
    const result = await storage.get([STORAGE_KEY, LEGACY_STORAGE_KEY, LEGACY_MIGRATION_FLAG_KEY]);
    const rawPayload = result?.[STORAGE_KEY] as unknown;
    await ensureLegacyAutoAdsMigration(rawPayload);
    const normalized = normalizeStructuredStoragePayload(rawPayload);
    const legacyMigrationDone = result?.[LEGACY_MIGRATION_FLAG_KEY] === true;
    if (!legacyMigrationDone && typeof result?.[LEGACY_STORAGE_KEY] !== 'undefined') {
      return maybeApplyLegacyInMemory(normalized.payload, result[LEGACY_STORAGE_KEY]);
    }
    return normalized.payload;
  }
  const rawText = localStorage.getItem(STORAGE_KEY);
  let parsed: unknown;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch (parseError) {
      // 1.14 — corruption backup is a WRITE, so it now happens only in
      // the SW realm (siteStorage.ts's readRawPayload). Non-SW realms
      // seeing a parse failure just return an empty payload and log; the
      // SW's next read will attempt the backup.
      console.warn('site-load-parse-failed', parseError);
      return { sites: {} };
    }
  } else {
    parsed = { sites: {} };
  }
  try {
    await ensureLegacyAutoAdsMigration(parsed);
    const normalized = normalizeStructuredStoragePayload(parsed);
    const legacyMigrationDone = localStorage.getItem(LEGACY_MIGRATION_FLAG_KEY) === '1';
    const legacyRawText = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyMigrationDone && legacyRawText) {
      let legacyParsed: unknown = null;
      try {
        legacyParsed = JSON.parse(legacyRawText);
      } catch {
        // Legacy blob doesn't parse — treat as if no legacy data present.
        return normalized.payload;
      }
      return maybeApplyLegacyInMemory(normalized.payload, legacyParsed);
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
