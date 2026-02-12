import { normalizeFlowSteps } from './flowStepMigration';
export const STORAGE_KEY = 'ladybird_sites';

export type SiteData = {
  elements: unknown[];
  flows: unknown[];
  hidden: unknown[];
};

export type StoragePayload = {
  sites: Record<string, SiteData>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const migrateLegacyFlowSteps = (payload: StoragePayload): { payload: StoragePayload; changed: boolean } => {
  const currentSites = payload?.sites || {};
  let changed = false;
  const nextSites: Record<string, SiteData> = {};

  Object.entries(currentSites).forEach(([siteKey, siteData]) => {
    const flows = Array.isArray(siteData?.flows) ? siteData.flows : [];
    let siteChanged = false;
    const nextFlows = flows.map((flow, index) => {
      if (!isRecord(flow)) {
        return flow;
      }
      const flowId =
        typeof flow.id === 'string' && flow.id.trim() ? flow.id.trim() : `${siteKey}-flow-${index + 1}`;
      if (!Array.isArray(flow.steps)) {
        return flow;
      }
      const nextSteps = normalizeFlowSteps(flow.steps, {
        flowId,
        keepNumber: true,
        sanitizeExisting: false,
      });
      if (nextSteps === flow.steps) {
        return flow;
      }
      siteChanged = true;
      return {
        ...flow,
        steps: nextSteps,
      };
    });

    if (siteChanged) {
      changed = true;
      nextSites[siteKey] = {
        elements: Array.isArray(siteData?.elements) ? siteData.elements : [],
        flows: nextFlows,
        hidden: Array.isArray(siteData?.hidden) ? siteData.hidden : [],
      };
      return;
    }

    nextSites[siteKey] = siteData;
  });

  if (!changed) {
    return { payload, changed: false };
  }
  return { payload: { sites: nextSites }, changed: true };
};

const getLocalStorage = () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  return null;
};

const readFromLocalStorage = async () => {
  const storage = getLocalStorage();
  if (storage) {
    const result = await storage.get(STORAGE_KEY);
    const payload = (result?.[STORAGE_KEY] as StoragePayload | undefined) || { sites: {} };
    const migrated = migrateLegacyFlowSteps(payload);
    if (migrated.changed) {
      await writeToLocalStorage(migrated.payload);
      return migrated.payload;
    }
    return payload;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const payload = raw ? (JSON.parse(raw) as StoragePayload) : { sites: {} };
    const migrated = migrateLegacyFlowSteps(payload);
    if (migrated.changed) {
      await writeToLocalStorage(migrated.payload);
      return migrated.payload;
    }
    return payload;
  } catch {
    return { sites: {} };
  }
};

const writeToLocalStorage = async (data: StoragePayload) => {
  const storage = getLocalStorage();
  if (storage) {
    await storage.set({ [STORAGE_KEY]: data });
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
};

export const getSiteData = async (siteKey: string): Promise<SiteData> => {
  const payload = await readFromLocalStorage();
  return payload.sites?.[siteKey] || { elements: [], flows: [], hidden: [] };
};

export const getAllSitesData = async (): Promise<Record<string, SiteData>> => {
  const payload = await readFromLocalStorage();
  return payload.sites || {};
};

export const setSiteData = async (siteKey: string, data: Partial<SiteData>) => {
  const payload = await readFromLocalStorage();
  const current = payload.sites?.[siteKey] || { elements: [], flows: [], hidden: [] };
  payload.sites = payload.sites || {};
  payload.sites[siteKey] = {
    elements: data.elements ?? current.elements,
    flows: data.flows ?? current.flows,
    hidden: data.hidden ?? current.hidden,
  };
  await writeToLocalStorage(payload);
};

export const setAllSitesData = async (sites: Record<string, SiteData>) => {
  await writeToLocalStorage({ sites: sites || {} });
};
