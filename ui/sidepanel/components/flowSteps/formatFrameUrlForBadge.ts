// F1 — Compact read-only display of a step's persisted iframe locator.
// Strips scheme + trailing slash so the badge shows "host/path" rather
// than "https://host/path/"; on unparseable inputs the raw URL is
// returned so the reader still sees something meaningful. CSS handles
// truncation; this is strictly a shortening of the visible string.
export const formatFrameUrlForBadge = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.host;
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${host}${path}` || trimmed;
  } catch {
    return trimmed;
  }
};
