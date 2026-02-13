import type { PageContextPayload } from '../../../shared/messages';

export type BrowserTab = {
  id?: number;
  url?: string;
  title?: string;
  status?: string;
  active?: boolean;
};

export type BrowserTabChangeInfo = {
  url?: string;
  status?: string;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const normalizeSiteKey = (value: string) =>
  value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');

export const deriveSiteKeyFromUrl = (url: string) => {
  if (!url) {
    return '';
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      return normalizeSiteKey((url.split(/[?#]/)[0] || url).trim());
    }
    const host = parsed.host || parsed.hostname || '';
    return normalizeSiteKey(host || url);
  } catch {
    return '';
  }
};

export const derivePageContext = (url: string, tabId?: number, title?: string): PageContextPayload => {
  const timestamp = Date.now();
  const hasAccess = /^https?:\/\//.test(url) || url.startsWith('file://');
  if (!hasAccess) {
    return {
      url: url || '',
      siteKey: '',
      pageKey: '',
      tabId,
      title,
      timestamp,
      hasAccess: false,
    };
  }
  try {
    const parsed = new URL(url);
    const host = parsed.host || parsed.hostname || '';
    const siteKey = normalizeSiteKey(host || url);
    const pathname = parsed.pathname || '/';
    const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return {
      url,
      siteKey,
      pageKey: `${siteKey}${cleanPath}`,
      tabId,
      title,
      timestamp,
      hasAccess: true,
    };
  } catch {
    return {
      url: url || '',
      siteKey: '',
      pageKey: '',
      tabId,
      title,
      timestamp,
      hasAccess: false,
    };
  }
};

export const isInjectableUrl = (url?: string) => {
  if (!url) {
    return false;
  }
  return /^https?:\/\//.test(url) || url.startsWith('file://');
};

const isReceivingEndMissing = (value?: string) => /receiving end does not exist/i.test(value || '');
const isMessageChannelClosed = (value?: string) =>
  /message channel(?:\s+is)?\s+closed|message port closed|back\/forward cache|asynchronous response|before a response was received/i.test(
    value || '',
  );

export const isRecoverableTabMessageError = (value?: string) =>
  isReceivingEndMissing(value) ||
  isMessageChannelClosed(value) ||
  value === 'content-unavailable' ||
  value === 'message-channel-closed';

export const normalizeForwardError = (value?: string) => {
  if (isReceivingEndMissing(value)) {
    return 'content-unavailable';
  }
  if (isMessageChannelClosed(value)) {
    return 'message-channel-closed';
  }
  return value || 'unknown-error';
};
