import enMessages from './i18n/locales/en.js';
import jaMessages from './i18n/locales/ja.js';
import zhCNMessages from './i18n/locales/zh-CN.js';

const messages = {
  en: enMessages,
  ja: jaMessages,
  'zh-CN': zhCNMessages,
};

const SUPPORTED_LOCALES = Object.keys(messages);
const FALLBACK_LOCALE = 'en';

const LOCALE_LABELS = {
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
};

const STORAGE_KEY = 'pageAugmentor.locale';

const systemLocale = resolveLocale(typeof navigator !== 'undefined' ? navigator.language : FALLBACK_LOCALE);

let currentLocale = systemLocale;
const subscribers = new Set();

/**
 * Resolves a locale string to the closest supported locale.
 * @param {string} input
 * @returns {keyof typeof messages}
 */
export function resolveLocale(input) {
  if (!input) {
    return FALLBACK_LOCALE;
  }
  const normalized = String(input).trim();
  if (messages[normalized]) {
    return /** @type {keyof typeof messages} */ (normalized);
  }
  const lower = normalized.toLowerCase();
  const direct = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === lower);
  if (direct) {
    return /** @type {keyof typeof messages} */ (direct);
  }
  const base = lower.split('-')[0];
  const baseMatch = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === base || locale.toLowerCase().startsWith(`${base}-`),
  );
  if (baseMatch) {
    return /** @type {keyof typeof messages} */ (baseMatch);
  }
  return FALLBACK_LOCALE;
}

/**
 * Returns the currently active locale.
 * @returns {keyof typeof messages}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Updates the active locale and notifies subscribers.
 * @param {string} locale
 * @returns {keyof typeof messages}
 */
export function setLocale(locale) {
  const resolved = resolveLocale(locale);
  if (resolved === currentLocale) {
    return currentLocale;
  }
  currentLocale = resolved;
  persistLocale(resolved);
  notifySubscribers();
  return currentLocale;
}

/**
 * Persists the current locale to storage when available.
 * @param {string} locale
 */
function persistLocale(locale) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: locale });
    }
  } catch (_error) {
    // Ignore persistence failures.
  }
}

/**
 * Notifies all subscribed listeners of the locale change.
 */
function notifySubscribers() {
  subscribers.forEach((listener) => {
    try {
      listener(currentLocale);
    } catch (_error) {
      // Ignore listener failures.
    }
  });
}

/**
 * Subscribes to locale changes.
 * @param {(locale: keyof typeof messages) => void} listener
 * @returns {() => void}
 */
export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/**
 * Retrieves a localized string for the provided key.
 * @param {string} key
 * @param {Record<string, string | number>} [values]
 * @returns {string}
 */
export function t(key, values) {
  const localeMessage = resolveMessage(messages[currentLocale], key);
  const fallbackMessage = localeMessage === undefined ? resolveMessage(messages[FALLBACK_LOCALE], key) : undefined;
  const template = localeMessage ?? fallbackMessage;
  if (typeof template !== 'string') {
    return key;
  }
  if (!values) {
    return template;
  }
  return template.replace(/\{([^}]+)\}/g, (match, token) => {
    if (Object.prototype.hasOwnProperty.call(values, token)) {
      return String(values[token]);
    }
    return match;
  });
}

/**
 * Resolves a nested value from the messages object.
 * @param {any} source
 * @param {string} key
 * @returns {unknown}
 */
function resolveMessage(source, key) {
  if (!source) {
    return undefined;
  }
  return key.split('.').reduce((value, part) => {
    if (value && typeof value === 'object' && part in value) {
      return value[part];
    }
    return undefined;
  }, source);
}

/**
 * Returns the available locale options with labels.
 * @returns {{ value: string; label: string }[]}
 */
export function getLocaleOptions() {
  const seen = new Set();
  const ordered = [currentLocale, ...SUPPORTED_LOCALES];
  return ordered
    .filter((locale) => {
      if (seen.has(locale)) {
        return false;
      }
      seen.add(locale);
      return true;
    })
    .map((locale) => ({
      value: locale,
      label: LOCALE_LABELS[locale] || locale,
    }));
}

/**
 * Formats a timestamp using the active locale.
 * @param {number} timestamp
 * @returns {string}
 */
export function formatDateTime(timestamp) {
  try {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(currentLocale, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(date);
  } catch (_error) {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }
}

/**
 * Loads any persisted locale preference.
 * @returns {Promise<keyof typeof messages>}
 */
async function loadPersistedLocale() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return currentLocale;
  }
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result?.[STORAGE_KEY];
    if (stored) {
      const resolved = resolveLocale(stored);
      if (resolved !== currentLocale) {
        currentLocale = resolved;
        notifySubscribers();
      }
    }
  } catch (_error) {
    // Ignore retrieval failures.
  }
  return currentLocale;
}

export const ready = loadPersistedLocale();

export const SYSTEM_LOCALE = systemLocale;
export const SUPPORTED = SUPPORTED_LOCALES;
export const DEFAULT_LOCALE = FALLBACK_LOCALE;
