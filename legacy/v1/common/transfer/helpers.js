import { normalizeSiteUrl } from '../url.js';

const VERSION_KEY = 'version';

function normalizeSiteKey(rawKey) {
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!key || key === VERSION_KEY) {
    return '';
  }
  if (key === 'global') {
    return key;
  }
  return normalizeSiteUrl(key) || key;
}

function ensureList(value, label) {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  throw new Error(`Invalid ${label} list.`);
}

function ensureSiteEntry(target, siteKey) {
  if (!target[siteKey]) {
    target[siteKey] = { elements: [], flows: [], hidden: [] };
  }
  return target[siteKey];
}

export { VERSION_KEY, normalizeSiteKey, ensureList, ensureSiteEntry };
