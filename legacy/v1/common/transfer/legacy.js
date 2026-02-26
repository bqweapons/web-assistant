import { ensureList, ensureSiteEntry, normalizeSiteKey } from './helpers.js';

function parsePayload(raw) {
  const sites = {};
  for (const [rawKey, list] of Object.entries(raw)) {
    const siteKey = normalizeSiteKey(rawKey);
    if (!siteKey) {
      throw new Error(`Import payload contains an invalid site key: ${rawKey}`);
    }
    const entry = ensureSiteEntry(sites, siteKey);
    entry.elements = ensureList(list, `elements for ${rawKey}`);
  }
  return { version: '', sites, includes: { elements: true, flows: false, hidden: false } };
}

export { parsePayload };
