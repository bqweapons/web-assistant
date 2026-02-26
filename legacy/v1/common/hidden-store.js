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

function normalizeScopeKey(rawKey) {
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!key) {
    throw new Error('Hidden rules store contains an invalid scope key.');
  }
  if (key === 'global') {
    return key;
  }
  const isSite = key.startsWith('site:');
  const isPage = key.startsWith('page:');
  if (!isSite && !isPage) {
    throw new Error(`Invalid hidden rules scope key: ${key}`);
  }
  const prefix = isSite ? 'site:' : 'page:';
  const rawUrl = key.slice(prefix.length);
  const normalizedUrl = isSite ? normalizeSiteUrl(rawUrl) : normalizePageUrl(rawUrl);
  if (!normalizedUrl) {
    throw new Error(`Invalid hidden rules scope key: ${key}`);
  }
  return `${prefix}${normalizedUrl}`;
}

function scopeDefaultsFromKey(scopeKey) {
  if (scopeKey === 'global') {
    return { scope: 'global', pageUrl: undefined };
  }
  if (scopeKey.startsWith('site:')) {
    return { scope: 'site', pageUrl: scopeKey.slice('site:'.length) };
  }
  if (scopeKey.startsWith('page:')) {
    return { scope: 'page', pageUrl: scopeKey.slice('page:'.length) };
  }
  return { scope: 'global', pageUrl: undefined };
}

function normalizeHiddenRule(rule, defaults) {
  if (!rule || typeof rule !== 'object') {
    throw new Error('Hidden rule entry is invalid.');
  }
  const id = typeof rule.id === 'string' && rule.id.trim() ? rule.id.trim() : '';
  if (!id) {
    throw new Error('Hidden rule entry is missing an id.');
  }
  const selector = typeof rule.selector === 'string' ? rule.selector.trim() : '';
  if (!selector) {
    throw new Error(`Hidden rule ${id} is missing a selector.`);
  }
  const now = Date.now();
  const scope =
    rule.scope === 'global' || rule.scope === 'site' || rule.scope === 'page' ? rule.scope : defaults.scope;
  const pageUrl = typeof rule.pageUrl === 'string' && rule.pageUrl.trim() ? rule.pageUrl : defaults.pageUrl;
  return {
    id,
    name: typeof rule.name === 'string' && rule.name.trim() ? rule.name.trim() : 'Hidden rule',
    selector,
    scope,
    pageUrl,
    frameSelectors: Array.isArray(rule.frameSelectors) ? rule.frameSelectors.map((s) => String(s)) : undefined,
    enabled: rule.enabled !== false,
    note: typeof rule.note === 'string' ? rule.note : '',
    createdAt: typeof rule.createdAt === 'number' ? rule.createdAt : now,
    updatedAt: typeof rule.updatedAt === 'number' ? rule.updatedAt : now,
  };
}

export function normalizeHiddenStore(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Hidden rules store must be an object.');
  }
  const payload = {};
  for (const [rawKey, list] of Object.entries(value)) {
    const scopeKey = normalizeScopeKey(rawKey);
    if (!Array.isArray(list)) {
      throw new Error(`Invalid hidden rules list for ${rawKey}.`);
    }
    if (list.length === 0) {
      continue;
    }
    const defaults = scopeDefaultsFromKey(scopeKey);
    payload[scopeKey] = list.map((rule) => normalizeHiddenRule(rule, defaults));
  }
  return payload;
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
 * Retrieves the full hidden rules store.
 * @returns {Promise<Record<string, any[]>>}
 */
export async function getFullHiddenStore() {
  const store = await readStore();
  const cloneStore = {};
  for (const [scopeKey, list] of Object.entries(store)) {
    if (!Array.isArray(list)) {
      continue;
    }
    cloneStore[scopeKey] = cloneList(list);
  }
  return cloneStore;
}

/**
 * Replaces the entire hidden rules store with a new payload.
 * @param {Record<string, any[]>} value
 * @returns {Promise<void>}
 */
export async function replaceHiddenStore(value) {
  const payload = normalizeHiddenStore(value);
  await writeStore(payload);
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
