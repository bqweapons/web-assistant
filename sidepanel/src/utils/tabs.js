import { normalizePageUrl } from '../../../common/url.js';

export async function findTabByPageUrl(pageUrl) {
  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => tab.url && normalizePageUrl(tab.url) === pageUrl);
}

export async function ensureTab(pageUrl) {
  const existing = await findTabByPageUrl(pageUrl);
  if (existing) {
    return existing;
  }
  return chrome.tabs.create({ url: pageUrl, active: true });
}
