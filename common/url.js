const FALLBACK_ORIGIN = 'https://extension.invalid';

/**
 * Normalizes a URL to a stable site key (origin only).
 * Query/hash/path are stripped; use when storing per-site buckets.
 * @param {string} input
 * @param {string} [base]
 * @returns {string}
 */
export function normalizeSiteUrl(input, base) {
  if (!input) {
    return '';
  }
  const reference = base || (typeof window !== 'undefined' ? window.location.href : FALLBACK_ORIGIN);
  try {
    const url = new URL(String(input), reference);
    return url.origin;
  } catch (_error) {
    const value = String(input || '').trim();
    if (!value) {
      return '';
    }
    const originMatch = value.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+/);
    if (originMatch) {
      return originMatch[0];
    }
    const questionIndex = value.indexOf('?');
    const hashIndex = value.indexOf('#');
    let end = value.length;
    if (questionIndex >= 0) {
      end = Math.min(end, questionIndex);
    }
    if (hashIndex >= 0) {
      end = Math.min(end, hashIndex);
    }
    return value.slice(0, end) || value;
  }
}

/**
 * Normalizes a URL to a page key (origin + pathname).
 * Query/hash are stripped; ensures trailing slash on bare origins.
 * @param {string} input
 * @param {string} [base]
 * @returns {string}
 */
export function normalizePageLocation(input, base) {
  if (!input) {
    return '';
  }
  const reference = base || (typeof window !== 'undefined' ? window.location.href : FALLBACK_ORIGIN);
  try {
    const url = new URL(String(input), reference);
    const pathname = url.pathname || '/';
    return `${url.origin}${pathname}`;
  } catch (_error) {
    const value = String(input || '').trim();
    if (!value) {
      return '';
    }
    const originMatch = value.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+/);
    const origin = originMatch ? originMatch[0] : '';
    if (!origin) {
      return normalizeSiteUrl(value, base);
    }
    const afterOrigin = value.slice(origin.length);
    const path = afterOrigin.split(/[?#]/)[0] || '/';
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

/**
 * Backward-compatible alias: returns site key (origin only).
 * @param {string} input
 * @param {string} [base]
 * @returns {string}
 */
export function normalizePageUrl(input, base) {
  return normalizeSiteUrl(input, base);
}

/**
 * Convenience helper returning the normalized key for the provided window.
 * @param {Window} [win]
 * @returns {string}
 */
export function currentPageKey(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win || !win.location) {
    return '';
  }
  return normalizeSiteUrl(win.location.href);
}

/**
 * Convenience helper returning the normalized page key (origin + pathname).
 * @param {Window} [win]
 * @returns {string}
 */
export function currentPageLocation(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win || !win.location) {
    return '';
  }
  return normalizePageLocation(win.location.href);
}

