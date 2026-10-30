import { describe, expect, it } from 'vitest';
import {
  derivePageKeyFromUrl,
  deriveSiteKey,
  deriveSiteKeyFromUrl,
  normalizeSiteKey,
  normalizeStoredPageKey,
} from '../../shared/urlKeys';

describe('normalizeSiteKey', () => {
  it('strips scheme, trailing slash and userinfo', () => {
    expect(normalizeSiteKey('https://example.com/')).toBe('example.com');
    expect(normalizeSiteKey('user:pass@example.com')).toBe('example.com');
  });

  it('keeps @ inside file paths', () => {
    expect(normalizeSiteKey('file:///home/alice@example/a.html')).toBe('/home/alice@example/a.html');
  });
});

describe('deriveSiteKeyFromUrl', () => {
  it('uses host and keeps non-default ports', () => {
    expect(deriveSiteKeyFromUrl('https://example.com/a?b=1')).toBe('example.com');
    expect(deriveSiteKeyFromUrl('http://127.0.0.1:8765/app')).toBe('127.0.0.1:8765');
    expect(deriveSiteKeyFromUrl('http://example.com:80/')).toBe('example.com');
  });

  it('returns empty string for non-URLs', () => {
    expect(deriveSiteKeyFromUrl('')).toBe('');
    expect(deriveSiteKeyFromUrl('not a url')).toBe('');
  });

  it('keys file URLs by path without query or hash', () => {
    expect(deriveSiteKeyFromUrl('file:///tmp/page.html?x=1#y')).toBe('/tmp/page.html');
  });
});

describe('deriveSiteKey (permissive)', () => {
  it('accepts bare hosts and URLs', () => {
    expect(deriveSiteKey('example.com')).toBe('example.com');
    expect(deriveSiteKey('  https://example.com/path ')).toBe('example.com');
    expect(deriveSiteKey('')).toBe('');
  });
});

describe('derivePageKeyFromUrl', () => {
  it('combines site key and path, ignoring query and hash', () => {
    expect(derivePageKeyFromUrl('https://example.com/a/b?q=1#h')).toBe('example.com/a/b');
    expect(derivePageKeyFromUrl('https://example.com')).toBe('example.com/');
  });
});

describe('normalizeStoredPageKey', () => {
  it('resolves path-only keys against the current page', () => {
    expect(normalizeStoredPageKey('/a', 'https://example.com/x')).toBe('example.com/a');
  });

  it('normalizes bare keys and full URLs to the same form', () => {
    expect(normalizeStoredPageKey('example.com/a?x=1')).toBe('example.com/a');
    expect(normalizeStoredPageKey('https://example.com/a?x=1')).toBe('example.com/a');
    expect(normalizeStoredPageKey('example.com')).toBe('example.com/');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeStoredPageKey(null)).toBe('');
    expect(normalizeStoredPageKey('   ')).toBe('');
  });
});
