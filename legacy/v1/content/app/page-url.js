import { normalizeSiteUrl, normalizePageLocation } from '../common/url.js';

export function getSiteKey() {
  return normalizeSiteUrl(window.location.href);
}

export function getPageKey() {
  return normalizePageLocation(window.location.href);
}

export function getPageContext() {
  return {
    siteKey: getSiteKey(),
    pageKey: getPageKey(),
  };
}

