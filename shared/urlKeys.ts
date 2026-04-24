// 2.6 — Single source of truth for URL/siteKey/pageKey derivation.
// Previously `normalizeSiteKey` and `deriveSiteKey` existed as independent
// duplicates in both this file and `siteDataSchema.ts`, with subtly different
// fallback semantics on URL-parse failure. That was exactly the silent-drift
// risk the code review called out ("broken feature if the two ever diverge").
// Both copies now live here; `siteDataSchema.ts` re-exports for compatibility
// with its ~15 import sites. Fix a bug here and every caller gets it.
//
// Two distinct derive functions, kept intentionally separate because they
// serve different input contracts — this is NOT a duplicate:
//   - `deriveSiteKeyFromUrl(url)`   : URL-only input; returns '' on parse fail.
//   - `deriveSiteKey(input)`        : permissive (URL or bare host); returns
//                                     normalized fallback on parse fail.
// Use the strict variant when you have a definite URL (tab.url, location
// href). Use the permissive variant when you're normalizing something that
// might already be a bare siteKey (storage migration, import).
//
// Known behavioral subtleties we do NOT change (documented here to prevent
// "helpful" future fixes from reintroducing drift):
//   - Ports are part of host. `URL.host` keeps non-default ports and strips
//     default ones; bare `host:port` passes through the fallback verbatim.
//     So `http://host:80/` and `http://host/` collapse to the same key, but
//     `http://host:8080/` gets a separate bucket. Correct for origin-ish
//     keying; don't "normalize" to drop ports without an origin-boundary
//     discussion.
//   - `file:///C:/foo` vs `file:///c:/foo` (Windows drive-letter case) land
//     in different buckets. Case-normalizing would help Windows but break
//     case-sensitive filesystems on mac/linux. Out of scope here.
//   - IDN is punycode-only (whatever URL.host returns). No Unicode NFC pass.
//   - UNC-style `file://user@server/path` has its userinfo stripped just like
//     http does, collapsing `file://alice@server/` and `file://bob@server/`
//     into the same key. Accepted false-positive: UNC-with-userinfo is rare
//     in a browser-extension threat model, and the worst case is key collision
//     (two user viewpoints merged), not credential leakage — file:// userinfo
//     is usually an auth identity, not a `user:pass` secret. Gating this
//     would require normalizeSiteKey to know its source protocol, which
//     breaks its purity as a string function. Not worth the complexity.

export const normalizeSiteKey = (value: string) => {
  let v = value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');
  // Strip userinfo (user:pass@) if present. `URL.host` on a successfully
  // parsed URL already excludes userinfo, so this is a no-op for anything
  // that flowed through URL parsing; it matters for bare-string inputs
  // from legacy migration where `user:pass@host` could otherwise land in
  // storage keys, splitting a site's bucket or leaking credentials into
  // key strings. file:// paths start with `/` after scheme strip, so the
  // `@` check is guarded to avoid mangling `file:///home/alice@example/...`.
  if (!v.startsWith('/')) {
    const atIndex = v.lastIndexOf('@');
    if (atIndex !== -1) {
      v = v.slice(atIndex + 1);
    }
  }
  return v;
};

// URL-only input. Returns '' when the input doesn't parse as a URL.
// Use this when the caller definitely has a URL (tab.url, location.href).
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

// Permissive input. Accepts URLs OR bare siteKeys (e.g. `example.com`,
// `example.com:8080`, `/Users/alice/file`). Falls back to treating the
// input as a bare key on URL-parse failure. Use this in storage /
// migration / import paths where the string's origin is mixed.
export const deriveSiteKey = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'file:') {
      return normalizeSiteKey(trimmed.split(/[?#]/)[0] || trimmed);
    }
    const host = parsed.host || parsed.hostname || '';
    return normalizeSiteKey(host || trimmed);
  } catch {
    return normalizeSiteKey(trimmed);
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
