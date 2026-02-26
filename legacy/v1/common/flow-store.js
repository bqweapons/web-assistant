import { normalizeSiteUrl } from './url.js';

const FLOW_STORE_KEY = 'actionFlows';

function storageArea() {
  return chrome.storage?.local || chrome.storage;
}

function normalizeSiteKey(rawKey) {
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!key) {
    return '';
  }
  const cleaned = key.startsWith('site:') ? key.slice('site:'.length) : key;
  return normalizeSiteUrl(cleaned) || '';
}

async function readStore() {
  const result = await storageArea().get(FLOW_STORE_KEY);
  const raw = result?.[FLOW_STORE_KEY];
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [rawKey, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) {
      continue;
    }
    const siteKey = normalizeSiteKey(rawKey);
    if (!siteKey) {
      continue;
    }
    if (!normalized[siteKey]) {
      normalized[siteKey] = [];
    }
    normalized[siteKey].push(...list);
  }
  return normalized;
}

async function writeStore(value) {
  await storageArea().set({ [FLOW_STORE_KEY]: value });
}

function clone(flow) {
  if (!flow || typeof flow !== 'object') return flow;
  const copy = { ...flow };
  if (Array.isArray(flow.tags)) {
    copy.tags = [...flow.tags];
  }
  if (Array.isArray(flow.steps)) {
    copy.steps = flow.steps.map((step) => ({ ...step }));
  }
  return copy;
}

function cloneList(list) {
  return Array.isArray(list) ? list.map((f) => clone(f)) : [];
}

function normalizeFlowEntry(entry, siteKey) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Flow entry is invalid.');
  }
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : '';
  if (!id) {
    throw new Error('Flow entry is missing an id.');
  }
  if (!Array.isArray(entry.steps)) {
    throw new Error(`Flow entry ${id} has invalid steps.`);
  }
  const now = Date.now();
  return {
    id,
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Untitled flow',
    description: typeof entry.description === 'string' ? entry.description : '',
    tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag)) : [],
    steps: entry.steps.map((step) => ({ ...step })),
    version: typeof entry.version === 'number' ? entry.version : 1,
    pageUrl: siteKey,
    createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : now,
    updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : now,
  };
}

export function normalizeFlowStore(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Flow store must be an object.');
  }
  const payload = {};
  for (const [rawKey, list] of Object.entries(value)) {
    const siteKey = normalizeSiteKey(rawKey);
    if (!siteKey) {
      throw new Error(`Flow store contains an invalid site key: ${rawKey}`);
    }
    if (!Array.isArray(list)) {
      throw new Error(`Invalid flow list for ${rawKey}.`);
    }
    if (list.length === 0) {
      continue;
    }
    payload[siteKey] = list.map((entry) => normalizeFlowEntry(entry, siteKey));
  }
  return payload;
}

/**
 * Lists flows for a site.
 * @param {{ pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function listFlows(params = {}) {
  const { pageUrl } = params || {};
  const siteKey = normalizeSiteUrl(pageUrl);
  if (!siteKey) {
    return [];
  }
  const store = await readStore();
  return cloneList(store[siteKey] || []);
}

/**
 * Retrieves the full flow store.
 * @returns {Promise<Record<string, any[]>>}
 */
export async function getFullFlowStore() {
  const store = await readStore();
  const cloneStore = {};
  for (const [siteKey, list] of Object.entries(store)) {
    if (!Array.isArray(list)) {
      continue;
    }
    cloneStore[siteKey] = cloneList(list);
  }
  return cloneStore;
}

/**
 * Replaces the entire flow store with a new payload.
 * @param {Record<string, any[]>} value
 * @returns {Promise<void>}
 */
export async function replaceFlowStore(value) {
  const payload = normalizeFlowStore(value);
  await writeStore(payload);
}

/**
 * Finds a flow by id.
 * @param {string} id
 * @returns {Promise<{ flow: any | null; siteKey: string | null }>}
 */
export async function findFlowById(id) {
  if (!id) return { flow: null, siteKey: null };
  const store = await readStore();
  for (const [siteKey, list] of Object.entries(store)) {
    if (!Array.isArray(list)) continue;
    const hit = list.find((f) => f.id === id);
    if (hit) {
      return { flow: clone(hit), siteKey };
    }
  }
  return { flow: null, siteKey: null };
}

/**
 * Upserts a flow and returns the updated list for the site.
 * @param {{ flow: any; pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function upsertFlow(params) {
  const { flow, pageUrl } = params || {};
  if (!flow) {
    throw new Error('Missing flow payload.');
  }
  const siteKey = normalizeSiteUrl(pageUrl || flow.pageUrl || flow.siteUrl);
  if (!siteKey) {
    throw new Error('Missing pageUrl for flow.');
  }
  const now = Date.now();
  const store = await readStore();
  const list = Array.isArray(store[siteKey]) ? cloneList(store[siteKey]) : [];
  const id = typeof flow.id === 'string' && flow.id ? flow.id : crypto.randomUUID();
  const index = list.findIndex((item) => item.id === id);
  const entry = {
    id,
    name: flow.name || 'Untitled flow',
    description: flow.description || '',
    tags: Array.isArray(flow.tags) ? flow.tags.map((t) => String(t)) : [],
    steps: Array.isArray(flow.steps) ? flow.steps.map((s) => ({ ...s })) : [],
    version: typeof flow.version === 'number' ? flow.version : 1,
    pageUrl: siteKey,
    createdAt: flow.createdAt || now,
    updatedAt: now,
  };
  if (index >= 0) {
    list[index] = { ...list[index], ...entry, createdAt: list[index].createdAt || entry.createdAt };
  } else {
    list.push(entry);
  }
  store[siteKey] = list;
  await writeStore(store);
  return cloneList(list);
}

/**
 * Deletes a flow by id.
 * @param {{ id: string; pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function deleteFlow(params) {
  const { id, pageUrl } = params || {};
  if (!id) throw new Error('Missing flow id.');
  const siteKey = normalizeSiteUrl(pageUrl);
  if (!siteKey) {
    throw new Error('Missing pageUrl for flow.');
  }
  const store = await readStore();
  const list = Array.isArray(store[siteKey]) ? cloneList(store[siteKey]) : [];
  const filtered = list.filter((item) => item.id !== id);
  if (filtered.length === 0) {
    delete store[siteKey];
  } else {
    store[siteKey] = filtered;
  }
  await writeStore(store);
  return cloneList(filtered);
}

export { FLOW_STORE_KEY };
