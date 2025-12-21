import { normalizePageUrl, normalizeSiteUrl } from './url.js';

const HIDDEN_STORE_KEY = 'hiddenRules';

function storageArea() {
  return chrome.storage?.local || chrome.storage;
}

async function readStore() {
  const result = await storageArea().get(HIDDEN_STORE_KEY);
  const raw = result?.[HIDDEN_STORE_KEY];
  return raw && typeof raw === 'object' ? raw : {};
}

async function writeStore(value) {
  await storageArea().set({ [HIDDEN_STORE_KEY]: value });
}

function cloneRule(rule) {
  if (!rule || typeof rule !== 'object') return rule;
  const copy = { ...rule };
  if (Array.isArray(rule.frameSelectors)) {
    copy.frameSelectors = [...rule.frameSelectors];
  }
  return copy;
}

function cloneList(list) {
  return Array.isArray(list) ? list.map((r) => cloneRule(r)) : [];
}

function keyForScope(scope, pageUrl) {
  if (scope === 'page' && pageUrl) {
    return `page:${normalizePageUrl(pageUrl)}`;
  }
  if (scope === 'site' && pageUrl) {
    return `site:${normalizeSiteUrl(pageUrl)}`;
  }
  return 'global';
}

/**
 * Lists rules for a scope key.
 * @param {{ scope?: 'global' | 'site' | 'page'; pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function listHiddenRules(params = {}) {
  const { scope = 'global', pageUrl } = params || {};
  const store = await readStore();
  const key = keyForScope(scope, pageUrl);
  return cloneList(store[key] || []);
}

/**
 * Returns effective rules for a given pageUrl (global + site + page).
 * @param {string} pageUrl
 * @returns {Promise<any[]>}
 */
export async function getEffectiveRules(pageUrl) {
  const store = await readStore();
  const results = [];
  const globalRules = store['global'];
  if (Array.isArray(globalRules)) {
    results.push(...globalRules);
  }
  const siteKey = keyForScope('site', pageUrl);
  if (Array.isArray(store[siteKey])) {
    results.push(...store[siteKey]);
  }
  const pageKey = keyForScope('page', pageUrl);
  if (Array.isArray(store[pageKey])) {
    results.push(...store[pageKey]);
  }
  return cloneList(results);
}

/**
 * Upserts a hidden rule.
 * @param {{ rule: any; scope?: 'global' | 'site' | 'page'; pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function upsertHiddenRule(params) {
  const { rule, scope = 'global', pageUrl } = params || {};
  if (!rule) throw new Error('Missing hidden rule payload.');
  const now = Date.now();
  const store = await readStore();
  const key = keyForScope(scope, pageUrl || rule.pageUrl);
  const list = Array.isArray(store[key]) ? cloneList(store[key]) : [];
  const id = typeof rule.id === 'string' && rule.id ? rule.id : crypto.randomUUID();
  const index = list.findIndex((item) => item.id === id);
  const entry = {
    id,
    name: rule.name || 'Hidden rule',
    selector: rule.selector || '',
    scope,
    pageUrl: rule.pageUrl || pageUrl,
    frameSelectors: Array.isArray(rule.frameSelectors) ? rule.frameSelectors.map((s) => String(s)) : undefined,
    enabled: rule.enabled !== false,
    note: rule.note || '',
    createdAt: rule.createdAt || now,
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
 * Deletes a hidden rule.
 * @param {{ id: string; scope?: 'global' | 'site' | 'page'; pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function deleteHiddenRule(params) {
  const { id, scope = 'global', pageUrl } = params || {};
  if (!id) throw new Error('Missing hidden rule id.');
  const store = await readStore();
  const key = keyForScope(scope, pageUrl);
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

/**
 * Sets enabled flag on a rule.
 * @param {{ id: string; enabled: boolean; scope?: 'global' | 'site' | 'page'; pageUrl?: string }} params
 * @returns {Promise<any[]>}
 */
export async function setHiddenRuleEnabled(params) {
  const { id, enabled, scope = 'global', pageUrl } = params || {};
  if (!id) throw new Error('Missing hidden rule id.');
  const store = await readStore();
  const key = keyForScope(scope, pageUrl);
  const list = Array.isArray(store[key]) ? cloneList(store[key]) : [];
  const index = list.findIndex((item) => item.id === id);
  if (index >= 0) {
    list[index] = { ...list[index], enabled: Boolean(enabled), updatedAt: Date.now() };
    store[key] = list;
    await writeStore(store);
  }
  return cloneList(list);
}

export { HIDDEN_STORE_KEY };
