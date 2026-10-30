import { describe, expect, it } from 'vitest';
import {
  SECRET_VAULT_TRANSFER_VERSION,
  buildSecretToken,
  isSecretTokenValue,
  parseSecretTokenValue,
  parseSecretVaultTransferPayload,
} from '../../shared/secrets';

describe('secret tokens', () => {
  it('builds and parses simple and quoted names', () => {
    expect(buildSecretToken('login')).toBe('{{secret.login}}');
    expect(parseSecretTokenValue('{{secret.login}}')).toEqual({ name: 'login' });
    const quoted = buildSecretToken('my "site" pw');
    expect(quoted.startsWith('{{secret["')).toBe(true);
    expect(isSecretTokenValue('{{ secret["a b"] }}')).toBe(true);
  });

  it('does not treat plain text as a token', () => {
    expect(isSecretTokenValue('password123')).toBe(false);
    expect(isSecretTokenValue('x {{secret.a}}')).toBe(false);
  });
});

describe('parseSecretVaultTransferPayload', () => {
  it('accepts the current version and drops non-string items', () => {
    const parsed = parseSecretVaultTransferPayload({
      version: SECRET_VAULT_TRANSFER_VERSION,
      items: { a: 'x', b: 1 },
    });
    expect(parsed?.items).toEqual({ a: 'x' });
  });

  it('rejects other versions', () => {
    expect(parseSecretVaultTransferPayload({ version: 'v0', items: {} })).toBeNull();
    expect(parseSecretVaultTransferPayload(null)).toBeNull();
  });
});
