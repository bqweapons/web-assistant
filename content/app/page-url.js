import { normalizePageUrl } from '../common/url.js';

export function getPageUrl() {
  return normalizePageUrl(window.location.href);
}

