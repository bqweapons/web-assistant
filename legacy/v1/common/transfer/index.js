import { EXPORT_VERSION } from './config.js';
import { VERSION_KEY, ensureList, ensureSiteEntry, normalizeSiteKey } from './helpers.js';
import { parsePayload as parseLegacyPayload } from './legacy.js';
import { parsePayload as parseLatestPayload } from './latest.js';

export function buildExportPayload({ elementsStore = {}, flowStore = {}, hiddenStore = {} } = {}) {
  const payload = { [VERSION_KEY]: EXPORT_VERSION };
  const sites = {};

  for (const [rawKey, list] of Object.entries(elementsStore || {})) {
    const siteKey = normalizeSiteKey(rawKey);
    if (!siteKey) {
      continue;
    }
    const entry = ensureSiteEntry(sites, siteKey);
    entry.elements = ensureList(list, `elements for ${rawKey}`);
  }

  for (const list of Object.values(flowStore || {})) {
    const flows = ensureList(list, 'flows');
    flows.forEach((flow) => {
      if (!flow || typeof flow !== 'object') {
        return;
      }
      const siteKey = normalizeSiteKey(flow.pageUrl || flow.siteUrl || '');
      if (!siteKey) {
        return;
      }
      const entry = ensureSiteEntry(sites, siteKey);
      entry.flows.push({ ...flow });
    });
  }

  for (const list of Object.values(hiddenStore || {})) {
    const rules = ensureList(list, 'hidden rules');
    rules.forEach((rule) => {
      if (!rule || typeof rule !== 'object') {
        return;
      }
      const scope = rule.scope;
      const siteKey =
        scope === 'global'
          ? 'global'
          : normalizeSiteKey(rule.pageUrl || rule.siteUrl || '');
      if (!siteKey) {
        return;
      }
      const entry = ensureSiteEntry(sites, siteKey);
      entry.hidden.push(rule);
    });
  }

  for (const [siteKey, entry] of Object.entries(sites)) {
    const elements = ensureList(entry.elements, `elements for ${siteKey}`);
    const flows = ensureList(entry.flows, `flows for ${siteKey}`);
    const hidden = ensureList(entry.hidden, `hidden rules for ${siteKey}`);
    if (elements.length === 0 && flows.length === 0 && hidden.length === 0) {
      continue;
    }
    payload[siteKey] = { elements, flows, hidden };
  }

  return payload;
}

export function parseTransferPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Import payload must be an object.');
  }
  const version = typeof raw[VERSION_KEY] === 'string' ? raw[VERSION_KEY].trim() : '';
  if (version) {
    return parseLatestPayload(raw, version);
  }
  const hasElements = Object.prototype.hasOwnProperty.call(raw, 'elements');
  const hasFlows = Object.prototype.hasOwnProperty.call(raw, 'flows');
  const hasHidden = Object.prototype.hasOwnProperty.call(raw, 'hidden') || Object.prototype.hasOwnProperty.call(raw, 'hiddenRules');
  if (hasElements || hasFlows || hasHidden) {
    return parseCombinedPayload(raw, { hasElements, hasFlows, hasHidden });
  }
  return parseLegacyPayload(raw);
}

function parseCombinedPayload(raw, flags) {
  const elementsStore = raw.elements;
  if (!elementsStore || typeof elementsStore !== 'object' || Array.isArray(elementsStore)) {
    throw new Error('Import payload contains an invalid elements store.');
  }
  const sites = {};
  for (const [rawKey, list] of Object.entries(elementsStore)) {
    const siteKey = normalizeSiteKey(rawKey);
    if (!siteKey) {
      throw new Error(`Import payload contains an invalid site key: ${rawKey}`);
    }
    const entry = ensureSiteEntry(sites, siteKey);
    entry.elements = ensureList(list, `elements for ${rawKey}`);
  }

  if (flags.hasFlows) {
    const flowStore = raw.flows;
    if (!flowStore || typeof flowStore !== 'object' || Array.isArray(flowStore)) {
      throw new Error('Import payload contains an invalid flows store.');
    }
    for (const [rawKey, list] of Object.entries(flowStore)) {
      const siteKey = normalizeSiteKey(rawKey);
      if (!siteKey) {
        continue;
      }
      const entry = ensureSiteEntry(sites, siteKey);
      entry.flows = ensureList(list, `flows for ${rawKey}`);
    }
  }

  if (flags.hasHidden) {
    const hiddenStore = raw.hidden ?? raw.hiddenRules;
    if (!hiddenStore || typeof hiddenStore !== 'object' || Array.isArray(hiddenStore)) {
      throw new Error('Import payload contains an invalid hidden rules store.');
    }
    for (const [rawKey, list] of Object.entries(hiddenStore)) {
      const siteKey = rawKey === 'global' ? 'global' : normalizeSiteKey(rawKey);
      if (!siteKey) {
        continue;
      }
      const entry = ensureSiteEntry(sites, siteKey);
      entry.hidden = entry.hidden.concat(ensureList(list, `hidden rules for ${rawKey}`));
    }
  }

  return { version: '', sites, includes: { elements: true, flows: flags.hasFlows, hidden: flags.hasHidden } };
}

export { EXPORT_VERSION };
