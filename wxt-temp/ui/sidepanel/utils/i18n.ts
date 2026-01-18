import { useSyncExternalStore } from 'react';

type I18nValue = string | number;
type LocaleMessages = Record<string, { message?: string }>;

export const LOCALE_OPTIONS = [
  { value: 'en', labelKey: 'sidepanel_language_en_us', fallback: 'English (US)' },
  { value: 'ja', labelKey: 'sidepanel_language_ja', fallback: 'Japanese' },
  { value: 'zh_CN', labelKey: 'sidepanel_language_zh_cn', fallback: 'Simplified Chinese' },
] as const;

export type SupportedLocale = typeof LOCALE_OPTIONS[number]['value'];

const LOCALE_STORAGE_KEY = 'sidepanel.locale';
const listeners = new Set<() => void>();
const messageCache: Partial<Record<SupportedLocale, LocaleMessages>> = {};
const messagePromises = new Map<SupportedLocale, Promise<LocaleMessages>>();

const isSupportedLocale = (value: string | null | undefined): value is SupportedLocale =>
  LOCALE_OPTIONS.some((option) => option.value === value);

const normalizeLocale = (value?: string | null): SupportedLocale => {
  if (isSupportedLocale(value)) {
    return value;
  }
  if (!value) {
    return 'en';
  }
  const normalized = value.toLowerCase().replace('_', '-');
  if (normalized.startsWith('zh')) {
    return 'zh_CN';
  }
  if (normalized.startsWith('ja')) {
    return 'ja';
  }
  return 'en';
};

const readStoredLocale = () => {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStoredLocale = (locale: SupportedLocale) => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors (e.g., privacy mode).
  }
};

const getBrowserLocale = () => {
  if (typeof chrome !== 'undefined' && chrome?.i18n?.getUILanguage) {
    return chrome.i18n.getUILanguage();
  }
  return null;
};

let currentLocale: SupportedLocale = normalizeLocale(readStoredLocale() ?? getBrowserLocale());

const notify = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getLocaleUrl = (locale: SupportedLocale) => {
  if (typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
    return chrome.runtime.getURL(`/_locales/${locale}/messages.json`);
  }
  return `/_locales/${locale}/messages.json`;
};

const loadMessages = async (locale: SupportedLocale): Promise<LocaleMessages> => {
  if (messageCache[locale]) {
    return messageCache[locale] as LocaleMessages;
  }
  const cachedPromise = messagePromises.get(locale);
  if (cachedPromise) {
    return cachedPromise;
  }
  const promise = (async () => {
    try {
      const response = await fetch(getLocaleUrl(locale));
      if (!response.ok) {
        return {};
      }
      const data = (await response.json()) as LocaleMessages;
      messageCache[locale] = data || {};
      return messageCache[locale] as LocaleMessages;
    } catch {
      messageCache[locale] = {};
      return messageCache[locale] as LocaleMessages;
    } finally {
      messagePromises.delete(locale);
    }
  })();
  messagePromises.set(locale, promise);
  return promise;
};

const primeLocale = () => {
  if (!messageCache[currentLocale]) {
    void loadMessages(currentLocale).then(() => notify());
  }
};

primeLocale();

const getMessageFromCache = (key: string) => {
  const messages = messageCache[currentLocale];
  if (!messages) {
    return '';
  }
  return messages[key]?.message ?? '';
};

const getMessage = (key: string) => {
  const cached = getMessageFromCache(key);
  if (cached) {
    return cached;
  }
  if (typeof chrome !== 'undefined' && chrome?.i18n?.getMessage) {
    return chrome.i18n.getMessage(key as Parameters<typeof chrome.i18n.getMessage>[0]);
  }
  return '';
};

export const t = (key: string, fallback?: I18nValue) => {
  const message = getMessage(key);
  if (message) {
    return message;
  }
  if (fallback !== undefined) {
    return String(fallback);
  }
  return key;
};

export const getLocale = () => currentLocale;

export const setLocale = async (locale: SupportedLocale) => {
  const nextLocale = normalizeLocale(locale);
  if (nextLocale === currentLocale) {
    return;
  }
  currentLocale = nextLocale;
  writeStoredLocale(nextLocale);
  notify();
  await loadMessages(nextLocale);
  notify();
};

export const useLocale = () => useSyncExternalStore(subscribe, () => currentLocale);

export const getLocaleLabel = (locale: SupportedLocale) => {
  switch (locale) {
    case 'ja':
      return 'ja-JP';
    case 'zh_CN':
      return 'zh-CN';
    default:
      return 'en-US';
  }
};
