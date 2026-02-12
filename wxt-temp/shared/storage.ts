const STORAGE_KEY = 'ladybird_sites';

type SiteData = {
  elements: unknown[];
  flows: unknown[];
  hidden: unknown[];
};

type StoragePayload = {
  sites: Record<string, SiteData>;
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
    return (result?.[STORAGE_KEY] as StoragePayload | undefined) || { sites: {} };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoragePayload) : { sites: {} };
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
