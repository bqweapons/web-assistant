// 1.14 — SW-only site-data writer. All persistent writes to
// `ladybird_sites` happen in this module. Sidepanel / content script
// realms never write directly; sidepanel reaches these operations via
// `shared/siteStorageClient.ts` (message-based wrapper), content scripts
// are read-only.
//
// Why SW-only (vs a cross-realm lock): `navigator.locks` is origin-scoped.
// Content scripts run in the HOST PAGE's origin while sidepanel and SW
// run in `chrome-extension://<id>/`. A lock acquired in one origin does
// NOT coordinate with a lock in another origin, so any cross-origin race
// is invisible to the lock. The only structural fix is to strip write
// capability from the non-SW realms outright — which is what 1.14 does.
//
// Reads stay free (any realm can call `getSiteData` / `getAllSitesData`
// from `shared/storage.ts`). The shared readers normalize in memory and
// return; they never persist back to disk. Persistence of read-path
// tidying (normalization writeback + legacy migration's flag flip) now
// happens ONLY when the SW performs a read + write compound, which is
// driven by:
// 1. Background bootstrap's prime-read (one call per SW cold start)
// 2. Any `SITES_SET_SITE` / `SITES_SET_ALL` handler (they read-normalize-
//    write-merge-write)

import {
  deriveSiteKey,
  type StructuredSiteData,
  type StructuredStoragePayload,
} from '../../shared/siteDataSchema';
import { ensureLegacyAutoAdsMigration } from '../../shared/globalSettings';
import { mergeSitesData, parseImportPayload } from '../../shared/importExport';
import { normalizeStructuredStoragePayload } from '../../shared/siteDataMigration';
import { SITE_DATA_STORAGE_KEY } from '../../shared/storageKeys';
import { StorageQuotaExceededError, CORRUPT_BACKUP_KEY } from '../../shared/storage';

// Legacy migration constants (kept parallel to shared/storage.ts so that
// removing legacy support in a future batch is a contained change to
// this file + shared/storage.ts).
const LEGACY_STORAGE_KEY = 'injectedElements';
const LEGACY_MIGRATION_FLAG_KEY = 'ladybird_legacy_migrated_v1';

// 1.14 — SW-realm write queue. Serializes all writes within the SW. Since
// this module is loaded only in the SW (it's never imported into sidepanel
// or content bundles), there is exactly ONE `writeQueue` instance and
// ONE writer realm. No cross-realm coordination is needed.
//
// INVARIANT: helpers suffixed `...Locked` assume they are already inside
// an `enqueueWrite` scope. They MUST NOT call `enqueueWrite` themselves
// (that would be a self-deadlock — the nested task waits on the outer
// task it is itself part of). Only the public entrypoints at the bottom
// of this file own the enqueueWrite wrapper.
let writeQueue: Promise<void> = Promise.resolve();
// One-shot attempt flag for legacy migration. Since every caller of the
// migration path runs inside enqueueWrite, there's no concurrent race —
// a boolean suffices. Left `false` on failure so the next write retries.
let legacyMigrationAttempted = false;

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

const isQuotaExceededError = (error: unknown): boolean => {
  if (error instanceof StorageQuotaExceededError) {
    return true;
  }
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return true;
    }
    if (error.code === 22 || error.code === 1014) {
      return true;
    }
  }
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && /quota/i.test(message) && /(exceeded|reached)/i.test(message)) {
    return true;
  }
  return false;
};

const setChromeStorage = async (
  storage: NonNullable<ReturnType<typeof getLocalStorage>>,
  items: Record<string, unknown>,
) => {
  try {
    await storage.set(items);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new StorageQuotaExceededError(error);
    }
    throw error;
  }
};

const setLocalStorageItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new StorageQuotaExceededError(error);
    }
    throw error;
  }
};

const readRawPayload = async (): Promise<unknown> => {
  const storage = getLocalStorage();
  if (storage) {
    const result = await storage.get(SITE_DATA_STORAGE_KEY);
    return result?.[SITE_DATA_STORAGE_KEY];
  }
  try {
    const raw = localStorage.getItem(SITE_DATA_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch (error) {
    console.warn('site-load-parse-failed', error);
    try {
      const existingBackup = localStorage.getItem(CORRUPT_BACKUP_KEY);
      if (!existingBackup) {
        const rawText = localStorage.getItem(SITE_DATA_STORAGE_KEY);
        if (rawText) {
          localStorage.setItem(
            CORRUPT_BACKUP_KEY,
            JSON.stringify({ corruptedAt: Date.now(), rawText }),
          );
        }
      }
    } catch (backupError) {
      console.warn('site-corruption-backup-failed', backupError);
    }
    return null;
  }
};

const writeStructuredPayload = async (payload: StructuredStoragePayload) => {
  const storage = getLocalStorage();
  if (storage) {
    await setChromeStorage(storage, { [SITE_DATA_STORAGE_KEY]: payload });
    return;
  }
  setLocalStorageItem(SITE_DATA_STORAGE_KEY, JSON.stringify(payload));
};

const persistNormalizedPayloadBestEffort = async (payload: StructuredStoragePayload) => {
  try {
    await writeStructuredPayload(payload);
  } catch (error) {
    if (error instanceof StorageQuotaExceededError) {
      console.warn('site-normalization-deferred-quota', error);
      return;
    }
    throw error;
  }
};

// 1.14 — legacy migration helper lives in SW now. Returns the migrated
// payload on success OR on quota-deferred persist; null when no migration
// was needed. Quota failures don't block: in-memory result is still
// returned so the caller's current read can use it; next attempt retries.
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

// 1.14 — Legacy migration body. Caller MUST already be inside an
// `enqueueWrite` scope (see INVARIANT above). Re-reads latest storage +
// legacy keys to avoid TOCTOU between the pre-check in
// `readStructuredPayloadLocked` and the actual merge+write.
const performLegacyMigrationLocked = async (
  storage: NonNullable<ReturnType<typeof getLocalStorage>> | null,
): Promise<StructuredStoragePayload | null> => {
  if (storage) {
    const latestRaw = await readRawPayload();
    const latestNormalized = normalizeStructuredStoragePayload(latestRaw);
    const latestLegacy = await storage.get([LEGACY_STORAGE_KEY, LEGACY_MIGRATION_FLAG_KEY]);
    if (
      latestLegacy?.[LEGACY_MIGRATION_FLAG_KEY] === true ||
      typeof latestLegacy?.[LEGACY_STORAGE_KEY] === 'undefined'
    ) {
      return null;
    }
    const migrated = tryMigrateLegacyPayload(
      latestNormalized.payload,
      latestLegacy[LEGACY_STORAGE_KEY],
    );
    if (!migrated) {
      return null;
    }
    try {
      await setChromeStorage(storage, {
        [SITE_DATA_STORAGE_KEY]: migrated,
        [LEGACY_MIGRATION_FLAG_KEY]: true,
      });
    } catch (error) {
      if (error instanceof StorageQuotaExceededError) {
        console.warn('legacy-site-migration-deferred-quota', error);
        return migrated;
      }
      throw error;
    }
    return migrated;
  }
  // localStorage fallback
  if (localStorage.getItem(LEGACY_MIGRATION_FLAG_KEY) === '1') {
    return null;
  }
  const latestLegacyRawText = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!latestLegacyRawText) {
    return null;
  }
  const latestRaw = await readRawPayload();
  const latestNormalized = normalizeStructuredStoragePayload(latestRaw);
  let legacyParsed: unknown = null;
  try {
    legacyParsed = JSON.parse(latestLegacyRawText);
  } catch (error) {
    console.warn('legacy-site-migration-parse-failed', error);
    return null;
  }
  const migrated = tryMigrateLegacyPayload(latestNormalized.payload, legacyParsed);
  if (!migrated) {
    return null;
  }
  try {
    await writeStructuredPayload(migrated);
    setLocalStorageItem(LEGACY_MIGRATION_FLAG_KEY, '1');
  } catch (error) {
    if (error instanceof StorageQuotaExceededError) {
      console.warn('legacy-site-migration-deferred-quota', error);
      return migrated;
    }
    throw error;
  }
  return migrated;
};

// 1.14 — SW's read path, which DOES perform normalization writeback and
// legacy migration persistence. Non-SW realms' reads go through the
// read-only path in `shared/storage.ts` and never touch persistence.
//
// INVARIANT: caller MUST be inside `enqueueWrite`. This function issues
// `storage.set` writes (normalization writeback + legacy migration) but
// never re-enters the queue, so nesting would be a deadlock.
const readStructuredPayloadLocked = async (): Promise<StructuredStoragePayload> => {
  const storage = getLocalStorage();
  const rawPayload = await readRawPayload();
  await ensureLegacyAutoAdsMigration(rawPayload);
  const normalized = normalizeStructuredStoragePayload(rawPayload);
  if (normalized.changed) {
    await persistNormalizedPayloadBestEffort(normalized.payload);
  }
  if (legacyMigrationAttempted) {
    return normalized.payload;
  }
  // Legacy auto-detect + auto-migrate (SW path).
  let legacyPresent = false;
  let legacyMigrationDone = false;
  if (storage) {
    const result = await storage.get([LEGACY_STORAGE_KEY, LEGACY_MIGRATION_FLAG_KEY]);
    legacyPresent = typeof result?.[LEGACY_STORAGE_KEY] !== 'undefined';
    legacyMigrationDone = result?.[LEGACY_MIGRATION_FLAG_KEY] === true;
  } else {
    legacyPresent = Boolean(localStorage.getItem(LEGACY_STORAGE_KEY));
    legacyMigrationDone = localStorage.getItem(LEGACY_MIGRATION_FLAG_KEY) === '1';
  }
  if (!legacyPresent || legacyMigrationDone) {
    legacyMigrationAttempted = true;
    return normalized.payload;
  }
  try {
    const migrated = await performLegacyMigrationLocked(storage);
    legacyMigrationAttempted = true;
    if (migrated) {
      const migratedNormalized = normalizeStructuredStoragePayload(migrated);
      if (migratedNormalized.changed) {
        await persistNormalizedPayloadBestEffort(migratedNormalized.payload);
      }
      return migratedNormalized.payload;
    }
  } catch (error) {
    // Leave `legacyMigrationAttempted` false so the next writer retries.
    console.warn('legacy-site-migration-failed', error);
  }
  return normalized.payload;
};

// 1.14 — Write entrypoints. Both shapes mirror the legacy API surface
// (`shared/storage.ts`'s `setSiteData` / `setAllSitesData`) so the
// message handlers in bootstrap.ts can forward arguments directly.

export const setSiteDataInSw = async (
  siteKey: string,
  data: Partial<StructuredSiteData>,
): Promise<void> => {
  const normalizedSiteKey = deriveSiteKey(siteKey) || siteKey.trim();
  if (!normalizedSiteKey) {
    return;
  }
  await enqueueWrite(async () => {
    const payload = await readStructuredPayloadLocked();
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

export const setAllSitesDataInSw = async (
  sites: Record<string, StructuredSiteData>,
): Promise<void> => {
  await enqueueWrite(async () => {
    const normalized = normalizeStructuredStoragePayload({ sites: sites || {} });
    await writeStructuredPayload(normalized.payload);
  });
};

// 1.14 — Called once at SW cold-start from bootstrap.ts. Triggers a full
// read-through-SW so that any pending normalization / legacy-migration
// gets persisted while we're in the writer realm. Best-effort: if anything
// throws, we swallow — bootstrap cannot block on storage I/O, and the next
// user-initiated write via SITES_SET_* will retry the same read path.
export const primeSiteStoragePersistence = async (): Promise<void> => {
  try {
    await enqueueWrite(async () => {
      await readStructuredPayloadLocked();
    });
  } catch (error) {
    console.warn('site-storage-prime-failed', error);
  }
};
