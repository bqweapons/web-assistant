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
// Legacy auto-migration (old extension -> new extension).
// To disable automatic legacy detection + migration in a future version, remove:
// 1) `LEGACY_STORAGE_KEY` and `LEGACY_MIGRATION_FLAG_KEY`
// 2) `legacyMigrationPromise`, `isRecord`, `tryMigrateLegacyPayload`,
//    `ensureLegacyMigrationForChromeStorage`, and `ensureLegacyMigrationForLocalStorage`
// 3) The legacy migration branches inside `readStructuredPayload` (both chrome.storage and localStorage paths)
const LEGACY_STORAGE_KEY = 'injectedElements';
const LEGACY_MIGRATION_FLAG_KEY = 'ladybird_legacy_migrated_v1';
// 2.7 — first-wins corruption backup key for the localStorage fallback path.
// When JSON.parse fails on the main key, we copy the raw bytes here once so
// a subsequent empty-write doesn't permanently erase the user's data. Later
// corruptions don't overwrite this backup — the first copy is the valuable
// one; subsequent failures are typically our-own-empty-writeback, which
// would replace a recoverable snapshot with a useless one.
const CORRUPT_BACKUP_KEY = 'ladybird_sites__corrupt_backup';

export type SiteData = StructuredSiteData;

export type StoragePayload = StructuredStoragePayload;

// 2.7 — typed error for storage quota exhaustion. Callers can distinguish
// "out of space" from other I/O failures and decide policy (retry / notify
// user / fail silently). storage.ts itself never renders UI.
export class StorageQuotaExceededError extends Error {
  readonly code = 'storage-quota-exceeded' as const;
  constructor(public readonly cause?: unknown) {
    super('storage quota exceeded');
    this.name = 'StorageQuotaExceededError';
  }
}

const EMPTY_SITE_DATA: SiteData = { elements: [], flows: [], hidden: [] };
let writeQueue: Promise<void> = Promise.resolve();
// 2.7 — the cached promise now resolves to the migrated payload (or null if
// no migration happened). Concurrent readers awaiting the same promise all
// get the in-memory migrated payload, which is critical when the persist
// step was quota-deferred (a fresh storage.get would return the pre-migration
// bytes).
let legacyMigrationPromise: Promise<StructuredStoragePayload | null> | null = null;

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

// 2.7 — quota detection covers both chrome.storage.local rejection messages
// (`QUOTA_BYTES quota exceeded` / `QUOTA_BYTES_PER_ITEM ...`) and Web Storage
// DOMException variants (`QuotaExceededError` on Chromium/WebKit,
// `NS_ERROR_DOM_QUOTA_REACHED` on Firefox). Legacy numeric codes 22 / 1014
// are kept as fallbacks for older engines.
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

// 2.7 — single chokepoint for `chrome.storage.local.set`. Any quota failure
// becomes a typed `StorageQuotaExceededError`; everything else propagates.
// Every write to chrome.storage in this module must go through this helper
// so detection is consistent.
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

// 2.7 — same chokepoint for the localStorage fallback. Quota failures are
// typed; other errors propagate. Callers can't silently swallow writes any
// more — the previous `catch { console.warn('site-load-failed', ...) }`
// mislabelled and dropped quota failures, leaving callers to believe the
// write succeeded.
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
    await setChromeStorage(storage, { [STORAGE_KEY]: payload });
    return;
  }
  setLocalStorageItem(STORAGE_KEY, JSON.stringify(payload));
};

// 2.7 — read-path re-normalization write-back must never fail the read just
// because we can't persist the tidy version. The in-memory normalized
// payload is correct regardless; deferring the persist prevents the
// "quota full => every read also throws" avalanche class. Actual user
// writes (`setSiteData` / `setAllSitesData`) still surface quota errors.
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

// 2.7 — first-wins backup of raw corrupt bytes before the read path returns
// an empty payload. Without this, the next write silently overwrites the
// only recoverable copy. Backup itself is best-effort — if it throws (quota
// or browser denial), swallow so the read still completes.
const backupCorruptLocalStorage = () => {
  try {
    const existingBackup = localStorage.getItem(CORRUPT_BACKUP_KEY);
    if (existingBackup) {
      return;
    }
    const rawText = localStorage.getItem(STORAGE_KEY);
    if (!rawText) {
      return;
    }
    localStorage.setItem(
      CORRUPT_BACKUP_KEY,
      JSON.stringify({ corruptedAt: Date.now(), rawText }),
    );
  } catch (error) {
    console.warn('site-corruption-backup-failed', error);
  }
};

type ReadStructuredPayloadOptions = {
  skipLegacyMigration?: boolean;
};

// 2.7 — returns the migrated payload on success *or* on quota-deferred
// persist (caller must prefer this over a fresh storage.get because the
// persisted bytes may still be pre-migration). Returns null when migration
// was a no-op (already done, or no legacy data to migrate, or legacy data
// didn't parse). All failure modes are logged and swallowed — legacy data
// not migrating cannot block reads of new data.
const ensureLegacyMigrationForChromeStorage = (
  storage: NonNullable<ReturnType<typeof getLocalStorage>>,
): Promise<StructuredStoragePayload | null> => {
  if (legacyMigrationPromise) {
    return legacyMigrationPromise;
  }
  legacyMigrationPromise = (async (): Promise<StructuredStoragePayload | null> => {
    const before = await storage.get([LEGACY_STORAGE_KEY, LEGACY_MIGRATION_FLAG_KEY]);
    if (before?.[LEGACY_MIGRATION_FLAG_KEY] === true || typeof before?.[LEGACY_STORAGE_KEY] === 'undefined') {
      return null;
    }
    return enqueueWrite(async () => {
      const latestPayload = await readStructuredPayload({ skipLegacyMigration: true });
      const latestLegacy = await storage.get([LEGACY_STORAGE_KEY, LEGACY_MIGRATION_FLAG_KEY]);
      if (
        latestLegacy?.[LEGACY_MIGRATION_FLAG_KEY] === true ||
        typeof latestLegacy?.[LEGACY_STORAGE_KEY] === 'undefined'
      ) {
        return null;
      }
      const migrated = tryMigrateLegacyPayload(latestPayload, latestLegacy[LEGACY_STORAGE_KEY]);
      if (!migrated) {
        return null;
      }
      try {
        // 2.7 — SINGLE atomic set: payload + flag in one call. Do NOT split
        // into two setChromeStorage calls — a half-applied state (payload
        // written, flag not) would cause every subsequent read to re-run
        // migration and re-merge already-migrated legacy data.
        await setChromeStorage(storage, {
          [STORAGE_KEY]: migrated,
          [LEGACY_MIGRATION_FLAG_KEY]: true,
        });
      } catch (error) {
        if (error instanceof StorageQuotaExceededError) {
          // 2.7 — degrade: don't persist, don't flip the flag. Return the
          // in-memory migrated payload anyway so the caller's current read
          // still reflects the merge. Next read retries (flag still unset);
          // once quota frees up the persist naturally succeeds. Without
          // this return value the caller would re-read from storage and
          // see the pre-migration bytes — the "quota avalanche" class.
          console.warn('legacy-site-migration-deferred-quota', error);
          return migrated;
        }
        throw error;
      }
      return migrated;
    });
  })()
    .catch((error) => {
      console.warn('legacy-site-migration-failed', error);
      return null;
    })
    .finally(() => {
      legacyMigrationPromise = null;
    });
  return legacyMigrationPromise;
};

const ensureLegacyMigrationForLocalStorage = (): Promise<StructuredStoragePayload | null> => {
  if (legacyMigrationPromise) {
    return legacyMigrationPromise;
  }
  legacyMigrationPromise = (async (): Promise<StructuredStoragePayload | null> => {
    const legacyMigrationDone = localStorage.getItem(LEGACY_MIGRATION_FLAG_KEY) === '1';
    const legacyRawText = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyMigrationDone || !legacyRawText) {
      return null;
    }
    return enqueueWrite(async () => {
      const latestPayload = await readStructuredPayload({ skipLegacyMigration: true });
      if (localStorage.getItem(LEGACY_MIGRATION_FLAG_KEY) === '1') {
        return null;
      }
      const latestLegacyRawText = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!latestLegacyRawText) {
        return null;
      }
      let legacyParsed: unknown = null;
      try {
        legacyParsed = JSON.parse(latestLegacyRawText);
      } catch (error) {
        console.warn('legacy-site-migration-parse-failed', error);
        return null;
      }
      const migrated = tryMigrateLegacyPayload(latestPayload, legacyParsed);
      if (!migrated) {
        return null;
      }
      try {
        // 2.7 — localStorage has no multi-key atomic write. Order is
        // payload-first then flag so a crash between the two leaves the
        // next read able to re-run migration; `tryMigrateLegacyPayload`
        // uses `mergeSitesData` which is idempotent over already-merged
        // inputs, so a replay is safe (wasteful, not corrupting).
        await writeStructuredPayload(migrated);
        setLocalStorageItem(LEGACY_MIGRATION_FLAG_KEY, '1');
      } catch (error) {
        if (error instanceof StorageQuotaExceededError) {
          // 2.7 — same degrade as the chrome.storage branch: return the
          // in-memory migrated payload; flag stays unset for retry.
          console.warn('legacy-site-migration-deferred-quota', error);
          return migrated;
        }
        throw error;
      }
      return migrated;
    });
  })()
    .catch((error) => {
      console.warn('legacy-site-migration-failed', error);
      return null;
    })
    .finally(() => {
      legacyMigrationPromise = null;
    });
  return legacyMigrationPromise;
};

// 2.7 — design-sketch-only hook point: to make the chrome.storage read path
// also trigger a corruption backup, extend `normalizeStructuredStoragePayload`
// to return `{payload, changed, corrupted?: 'shape-invalid' | 'field-invalid' | ...}`.
// The current `changed` flag cannot distinguish "tidied an empty array"
// from "input was structurally broken". Implementing that enum is out of
// 2.7 scope — it lives in siteDataMigration.ts and has wider blast radius;
// batch together with 3.7 runtime validator.
const readStructuredPayload = async (
  options?: ReadStructuredPayloadOptions,
): Promise<StructuredStoragePayload> => {
  const storage = getLocalStorage();
  if (storage) {
    const result = await storage.get([STORAGE_KEY, LEGACY_STORAGE_KEY, LEGACY_MIGRATION_FLAG_KEY]);
    const rawPayload = result?.[STORAGE_KEY] as unknown;
    await ensureLegacyAutoAdsMigration(rawPayload);
    const normalized = normalizeStructuredStoragePayload(rawPayload);
    if (normalized.changed) {
      await persistNormalizedPayloadBestEffort(normalized.payload);
    }
    // Legacy auto-detect + auto-migrate (chrome.storage path).
    // Delete this whole block to stop automatic migration from `injectedElements`.
    if (!options?.skipLegacyMigration) {
      const legacyMigrationDone = result?.[LEGACY_MIGRATION_FLAG_KEY] === true;
      if (!legacyMigrationDone && typeof result?.[LEGACY_STORAGE_KEY] !== 'undefined') {
        // 2.7 — consume the in-memory migrated payload directly. The helper
        // returns non-null whether the persist succeeded OR was quota-
        // deferred; either way this is the authoritative post-merge view
        // for the current read. Do not re-read from storage — that would
        // miss the merge under quota pressure.
        const migrated = await ensureLegacyMigrationForChromeStorage(storage);
        if (migrated) {
          const migratedNormalized = normalizeStructuredStoragePayload(migrated);
          if (migratedNormalized.changed) {
            await persistNormalizedPayloadBestEffort(migratedNormalized.payload);
          }
          return migratedNormalized.payload;
        }
        // null means "no migration happened" — either the flag was already
        // set by a concurrent path, or legacy data was undefined/invalid.
        // Fall through and return the original normalize result.
      }
    }
    return normalized.payload;
  }
  // 2.7 — two-level error handling on the localStorage fallback.
  //
  // Inner: ONLY the JSON.parse of the raw bytes. A throw here is the one
  // case where "raw bytes are corrupt" is the right diagnosis, and is the
  // ONLY case that should trigger the first-wins corruption backup. The
  // `site-load-parse-failed` tag reflects exactly this.
  //
  // Outer: everything that runs AFTER parse succeeds (normalize, persist,
  // legacy-ads migration, legacy-sites migration). Any throw here is a
  // downstream bug / infra failure, not data corruption — backing up the
  // (perfectly-valid) raw bytes would just waste the first-wins slot on
  // an unrelated incident. Generic `site-load-failed` tag, no backup.
  const rawText = localStorage.getItem(STORAGE_KEY);
  let parsed: unknown;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch (parseError) {
      console.warn('site-load-parse-failed', parseError);
      backupCorruptLocalStorage();
      return { sites: {} };
    }
  } else {
    parsed = { sites: {} };
  }
  try {
    await ensureLegacyAutoAdsMigration(parsed);
    const normalized = normalizeStructuredStoragePayload(parsed);
    if (normalized.changed) {
      await persistNormalizedPayloadBestEffort(normalized.payload);
    }
    // Legacy auto-detect + auto-migrate (localStorage fallback path).
    // Delete this whole block to stop automatic migration from legacy localStorage data.
    if (!options?.skipLegacyMigration) {
      const legacyMigrationDone = localStorage.getItem(LEGACY_MIGRATION_FLAG_KEY) === '1';
      const legacyRawText = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyMigrationDone && legacyRawText) {
        // 2.7 — consume in-memory migrated payload; see chrome.storage
        // branch comment above.
        const migrated = await ensureLegacyMigrationForLocalStorage();
        if (migrated) {
          const migratedNormalized = normalizeStructuredStoragePayload(migrated);
          if (migratedNormalized.changed) {
            await persistNormalizedPayloadBestEffort(migratedNormalized.payload);
          }
          return migratedNormalized.payload;
        }
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
    const payload = await readStructuredPayload({ skipLegacyMigration: true });
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
