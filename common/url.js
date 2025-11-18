const FALLBACK_ORIGIN = 'https://extension.invalid';

/**
 * Normalizes a URL into a stable, site-scoped storage key.
 * Keeps only the origin (scheme + host + optional port) so that all
 * routes on the same site share the same key. Query and hash are ignored.
 * @param {string} input
 * @param {string} [base]
 * @returns {string}
 */
export function normalizePageUrl(input, base) {
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
    // Fallback: try to extract a scheme + host prefix; if that fails,
    // strip query/hash and return the remaining prefix.
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
 * Convenience helper returning the normalized key for the provided window.
 * @param {Window} [win]
 * @returns {string}
 */
export function currentPageKey(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win || !win.location) {
    return '';
  }
  return normalizePageUrl(win.location.href);
}

