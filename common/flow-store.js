import { normalizeSiteUrl } from './url.js';

const FLOW_STORE_KEY = 'actionFlows';

function storageArea() {
  return chrome.storage?.local || chrome.storage;
}

async function readStore() {
  const result = await storageArea().get(FLOW_STORE_KEY);
  const raw = result?.[FLOW_STORE_KEY];
  return raw && typeof raw === 'object' ? raw : {};
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

function resolveScope(scope, pageUrl) {
  if (scope === 'page' && pageUrl) {
    return `page:${normalizeSiteUrl(pageUrl)}`;
  }
  if (scope === 'site' && pageUrl) {
    return `site:${normalizeSiteUrl(pageUrl)}`;
  }
  return 'global';
}

/**
 * Lists flows for a scope.
 * @param {{ scope?: 'global' | 'site' | 'page'; pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function listFlows(params = {}) {
  const { scope = 'global', pageUrl } = params || {};
  const store = await readStore();
  const key = resolveScope(scope, pageUrl);
  return cloneList(store[key] || []);
}

/**
 * Finds a flow by id across scopes.
 * @param {string} id
 * @returns {Promise<{ flow: any | null; scopeKey: string | null }>}
 */
export async function findFlowById(id) {
  if (!id) return { flow: null, scopeKey: null };
  const store = await readStore();
  for (const [scopeKey, list] of Object.entries(store)) {
    if (!Array.isArray(list)) continue;
    const hit = list.find((f) => f.id === id);
    if (hit) {
      return { flow: clone(hit), scopeKey };
    }
  }
  return { flow: null, scopeKey: null };
}

/**
 * Upserts a flow and returns the updated list for the scope.
 * @param {{ flow: any; scope?: 'global' | 'site' | 'page'; pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function upsertFlow(params) {
  const { flow, scope = 'global', pageUrl } = params || {};
  if (!flow) {
    throw new Error('Missing flow payload.');
  }
  const now = Date.now();
  const store = await readStore();
  const key = resolveScope(scope, pageUrl || flow.pageUrl);
  const list = Array.isArray(store[key]) ? cloneList(store[key]) : [];
  const id = typeof flow.id === 'string' && flow.id ? flow.id : crypto.randomUUID();
  const index = list.findIndex((item) => item.id === id);
  const entry = {
    id,
    name: flow.name || 'Untitled flow',
    description: flow.description || '',
    tags: Array.isArray(flow.tags) ? flow.tags.map((t) => String(t)) : [],
    steps: Array.isArray(flow.steps) ? flow.steps.map((s) => ({ ...s })) : [],
    version: typeof flow.version === 'number' ? flow.version : 1,
    scope,
    pageUrl: flow.pageUrl || pageUrl,
    createdAt: flow.createdAt || now,
    updatedAt: now,
  };
  if (index >= 0) {
    list[index] = { ...list[index], ...entry, createdAt: list[index].createdAt || entry.createdAt };
  } else {
    list.push(entry);
  }
  store[key] = list;
  await writeStore(store);
  return cloneList(list);
}

/**
 * Deletes a flow by id.
 * @param {{ id: string; scope?: 'global' | 'site' | 'page'; pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function deleteFlow(params) {
  const { id, scope = 'global', pageUrl } = params || {};
  if (!id) throw new Error('Missing flow id.');
  const store = await readStore();
  const key = resolveScope(scope, pageUrl);
  const list = Array.isArray(store[key]) ? cloneList(store[key]) : [];
  const filtered = list.filter((item) => item.id !== id);
  if (filtered.length === 0) {
    delete store[key];
  } else {
    store[key] = filtered;
  }
  await writeStore(store);
  return cloneList(filtered);
}

export { FLOW_STORE_KEY };
