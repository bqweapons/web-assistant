import { VERSION_KEY, ensureList, ensureSiteEntry, normalizeSiteKey } from './helpers.js';

// Latest export format parser.
function parsePayload(raw, version) {
  const sites = {};
  let includesFlows = false;
  let includesHidden = false;
  for (const [rawKey, value] of Object.entries(raw)) {
    if (rawKey === VERSION_KEY) {
      continue;
    }
    const siteKey = normalizeSiteKey(rawKey);
    if (!siteKey) {
      throw new Error(`Import payload contains an invalid site key: ${rawKey}`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Invalid site entry for ${rawKey}.`);
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'elements')) {
      throw new Error(`Missing elements list for ${rawKey}.`);
    }
    const elements = ensureList(value.elements, `elements for ${rawKey}`);
    const flowsProvided = Object.prototype.hasOwnProperty.call(value, 'flows');
    const hiddenProvided =
      Object.prototype.hasOwnProperty.call(value, 'hidden') || Object.prototype.hasOwnProperty.call(value, 'hiddenRules');
    const flows = flowsProvided ? ensureList(value.flows, `flows for ${rawKey}`) : [];
    const hidden = hiddenProvided
      ? ensureList(value.hidden ?? value.hiddenRules, `hidden rules for ${rawKey}`)
      : [];
    includesFlows = includesFlows || flowsProvided;
    includesHidden = includesHidden || hiddenProvided;
    sites[siteKey] = { elements, flows, hidden };
  }
  return { version, sites, includes: { elements: true, flows: includesFlows, hidden: includesHidden } };
}

export { parsePayload };
