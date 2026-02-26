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

export const derivePageKeyFromUrl = (url: string) => {
  if (!url) {
    return '';
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      return normalizeSiteKey((url.split(/[?#]/)[0] || url).trim());
    }
    const siteKey = deriveSiteKeyFromUrl(url);
    if (!siteKey) {
      return '';
    }
    const path = parsed.pathname || '/';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${siteKey}${normalizedPath}`;
  } catch {
    return '';
  }
};

export const normalizeStoredPageKey = (value?: string | null, fallbackHref = '') => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('/')) {
    const siteKey = deriveSiteKeyFromUrl(fallbackHref);
    return siteKey ? `${siteKey}${trimmed}` : trimmed;
  }
  if (!/^https?:\/\//.test(trimmed) && !trimmed.startsWith('file://')) {
    const withoutScheme = trimmed.replace(/^https?:\/\//, '').replace(/^file:\/\//, '');
    const withoutQuery = (withoutScheme.split(/[?#]/)[0] || withoutScheme).trim();
    if (!withoutQuery) {
      return '';
    }
    const slashIndex = withoutQuery.indexOf('/');
    if (slashIndex === -1) {
      const siteOnly = normalizeSiteKey(withoutQuery);
      return siteOnly ? `${siteOnly}/` : '';
    }
    const siteKey = normalizeSiteKey(withoutQuery.slice(0, slashIndex));
    const pathRaw = withoutQuery.slice(slashIndex);
    const path = pathRaw ? `/${pathRaw.replace(/^\/+/, '')}` : '/';
    return siteKey ? `${siteKey}${path}` : path;
  }
  try {
    return derivePageKeyFromUrl(new URL(trimmed, fallbackHref || undefined).toString());
  } catch {
    return '';
  }
};
