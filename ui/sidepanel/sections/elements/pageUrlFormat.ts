// Page URL label/href helpers extracted from ElementsSection. The label
// formatters collapse to a host/path display for the element-group header
// and must stay identical to the previous inline implementation so the
// grouping keys match.

export const getPageHref = (pageUrl: string, siteUrl: string) => {
  if (pageUrl.startsWith('http://') || pageUrl.startsWith('https://') || pageUrl.startsWith('file://')) {
    return pageUrl;
  }
  const siteHasScheme =
    siteUrl.startsWith('http://') || siteUrl.startsWith('https://') || siteUrl.startsWith('file://');
  const siteRoot = siteUrl.replace(/\/$/, '');
  if (pageUrl.startsWith('/')) {
    return siteHasScheme ? `${siteRoot}${pageUrl}` : `https://${siteRoot}${pageUrl}`;
  }
  if (pageUrl.includes('/')) {
    return `https://${pageUrl}`;
  }
  if (siteHasScheme) {
    return siteUrl;
  }
  return `https://${siteRoot}`;
};

export const getPageLabel = (
  pageUrl: string,
  siteUrl: string,
  unknownLabel: string,
) => {
  if (!pageUrl) {
    return unknownLabel;
  }
  const formatHostPath = (host: string, pathname: string) => {
    const cleanPath = pathname.replace(/^\/+/, '');
    return cleanPath ? `${host}/${cleanPath}` : host;
  };
  if (pageUrl.startsWith('http://') || pageUrl.startsWith('https://') || pageUrl.startsWith('file://')) {
    try {
      const url = new URL(pageUrl);
      if (url.protocol === 'file:') {
        const fileName = url.pathname.split('/').pop();
        return fileName || url.pathname || pageUrl;
      }
      const isRoot = url.pathname === '/' && !url.search && !url.hash;
      const hasExplicitTrailingSlash = pageUrl.endsWith('/') && !pageUrl.endsWith('://');
      if (isRoot) {
        const origin = `${url.protocol}//${url.host}`;
        return hasExplicitTrailingSlash ? `${origin}/` : origin;
      }
      return `${url.protocol}//${formatHostPath(url.host, url.pathname)}`;
    } catch {
      return pageUrl;
    }
  }
  if (pageUrl.startsWith('/')) {
    const siteHost = siteUrl.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');
    if (siteHost) {
      if (pageUrl === '/') {
        return `${siteHost}/`;
      }
      return formatHostPath(siteHost, pageUrl);
    }
    return pageUrl.replace(/^\/+/, '');
  }
  const [hostCandidate, ...rest] = pageUrl.split('/');
  if (rest.length > 0) {
    return formatHostPath(hostCandidate, `/${rest.join('/')}`);
  }
  return pageUrl;
};

export const getPagePathLabel = (pageUrl: string, siteUrl: string) => {
  try {
    const href = getPageHref(pageUrl, siteUrl);
    const parsed = new URL(href);
    const path = parsed.pathname || '/';
    return path || '/';
  } catch {
    if (pageUrl.startsWith('/')) {
      return pageUrl || '/';
    }
    const [, ...rest] = pageUrl.split('/');
    return rest.length ? `/${rest.join('/')}` : '/';
  }
};
