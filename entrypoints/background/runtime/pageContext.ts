import type { PageContextPayload } from '../../../shared/messages';
import { derivePageKeyFromUrl, deriveSiteKeyFromUrl } from '../../../shared/urlKeys';

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
    const siteKey = deriveSiteKeyFromUrl(url);
    const pageKey = derivePageKeyFromUrl(url);
    return {
      url,
      siteKey,
      pageKey,
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
