const FALLBACK_ORIGIN = 'https://extension.invalid';

/**
 * Normalizes a URL so it can be used as a stable storage key.
 * The query string and hash fragment are ignored so that variants of the same page share a key.
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
    return `${url.origin}${url.pathname}`;
  } catch (error) {
    const value = String(input || '').trim();
    if (!value) {
      return '';
    }
    const questionIndex = value.indexOf('?');
    if (questionIndex >= 0) {
      return value.slice(0, questionIndex) || value;
    }
    const hashIndex = value.indexOf('#');
    if (hashIndex >= 0) {
      return value.slice(0, hashIndex) || value;
    }
    return value;
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
