import { AUTO_ADS_RULE_PREFIX } from './hiddenRulePresets';
import { GLOBAL_SETTINGS_STORAGE_KEY, SITE_DATA_STORAGE_KEY } from './storageKeys';
import { isRecord } from './siteDataUtils';

const GLOBAL_SETTINGS_MIGRATION_FLAG_KEY = 'ladybird_global_settings_migrated_auto_ads_v1';
export { GLOBAL_SETTINGS_STORAGE_KEY };

export type GlobalSettings = {
  autoHideAdsEnabled: boolean;
};

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  autoHideAdsEnabled: false,
};

const getLocalStorage = () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  return null;
};

export const normalizeGlobalSettings = (raw: unknown): GlobalSettings => {
  if (!isRecord(raw)) {
    return { ...DEFAULT_GLOBAL_SETTINGS };
  }
  return {
    autoHideAdsEnabled: raw.autoHideAdsEnabled === true,
  };
};

const hasLegacyAutoAdsEnabled = (rawPayload: unknown) => {
  if (!isRecord(rawPayload) || !isRecord(rawPayload.sites)) {
    return false;
  }

  return Object.values(rawPayload.sites).some((siteData) => {
    if (!isRecord(siteData) || !Array.isArray(siteData.hidden)) {
      return false;
    }
    return siteData.hidden.some((rule) => {
      if (!isRecord(rule)) {
        return false;
      }
      const id = typeof rule.id === 'string' ? rule.id : '';
      return id.startsWith(AUTO_ADS_RULE_PREFIX) && rule.enabled !== false;
    });
  });
};

const writeLocalFallback = (settings: GlobalSettings, migrated: boolean) => {
  try {
    localStorage.setItem(GLOBAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    if (migrated) {
      localStorage.setItem(GLOBAL_SETTINGS_MIGRATION_FLAG_KEY, '1');
    }
  } catch {
    // Ignore storage errors in privacy mode.
  }
};

export const ensureLegacyAutoAdsMigration = async (rawSitePayload?: unknown) => {
  const storage = getLocalStorage();

  if (storage) {
    const result =
      typeof rawSitePayload === 'undefined'
        ? await storage.get([
            GLOBAL_SETTINGS_STORAGE_KEY,
            GLOBAL_SETTINGS_MIGRATION_FLAG_KEY,
            SITE_DATA_STORAGE_KEY,
          ])
        : await storage.get([GLOBAL_SETTINGS_STORAGE_KEY, GLOBAL_SETTINGS_MIGRATION_FLAG_KEY]);
    if (result?.[GLOBAL_SETTINGS_MIGRATION_FLAG_KEY] === true) {
      return;
    }
    const rawPayload =
      typeof rawSitePayload === 'undefined' ? result?.[SITE_DATA_STORAGE_KEY] : rawSitePayload;
    const nextSettings = normalizeGlobalSettings(result?.[GLOBAL_SETTINGS_STORAGE_KEY]);
    if (hasLegacyAutoAdsEnabled(rawPayload)) {
      nextSettings.autoHideAdsEnabled = true;
      await storage.set({
        [GLOBAL_SETTINGS_STORAGE_KEY]: nextSettings,
        [GLOBAL_SETTINGS_MIGRATION_FLAG_KEY]: true,
      });
      return;
    }
    await storage.set({ [GLOBAL_SETTINGS_MIGRATION_FLAG_KEY]: true });
    return;
  }

  try {
    if (localStorage.getItem(GLOBAL_SETTINGS_MIGRATION_FLAG_KEY) === '1') {
      return;
    }
    const currentSettings = normalizeGlobalSettings(
      JSON.parse(localStorage.getItem(GLOBAL_SETTINGS_STORAGE_KEY) || 'null') as unknown,
    );
    const localRawPayload =
      typeof rawSitePayload === 'undefined'
        ? (JSON.parse(localStorage.getItem(SITE_DATA_STORAGE_KEY) || 'null') as unknown)
        : rawSitePayload;
    if (hasLegacyAutoAdsEnabled(localRawPayload)) {
      writeLocalFallback({ ...currentSettings, autoHideAdsEnabled: true }, true);
      return;
    }
    writeLocalFallback(currentSettings, true);
  } catch {
    writeLocalFallback(DEFAULT_GLOBAL_SETTINGS, true);
  }
};

export const getGlobalSettings = async (): Promise<GlobalSettings> => {
  await ensureLegacyAutoAdsMigration();
  const storage = getLocalStorage();
  if (storage) {
    const result = await storage.get(GLOBAL_SETTINGS_STORAGE_KEY);
    return normalizeGlobalSettings(result?.[GLOBAL_SETTINGS_STORAGE_KEY]);
  }
  try {
    return normalizeGlobalSettings(
      JSON.parse(localStorage.getItem(GLOBAL_SETTINGS_STORAGE_KEY) || 'null') as unknown,
    );
  } catch {
    return { ...DEFAULT_GLOBAL_SETTINGS };
  }
};

export const setGlobalSettings = async (data: Partial<GlobalSettings>) => {
  const current = await getGlobalSettings();
  const next = normalizeGlobalSettings({ ...current, ...data });
  const storage = getLocalStorage();
  if (storage) {
    await storage.set({ [GLOBAL_SETTINGS_STORAGE_KEY]: next });
    return;
  }
  writeLocalFallback(next, localStorage.getItem(GLOBAL_SETTINGS_MIGRATION_FLAG_KEY) === '1');
};
