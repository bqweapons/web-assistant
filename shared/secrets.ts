// 1.1 — This file now contains ONLY pure helpers and type declarations.
// Anything that touches the AES key, reads the vault payload from storage,
// or otherwise requires vault state lives in
// `entrypoints/background/secretsVault.ts` (SW-only). Sidepanel / content
// scripts reach those operations via `shared/secretsClient.ts` (a message-
// based wrapper); the AES key is a non-extractable CryptoKey that never
// leaves the SW realm.
//
// Pure functions here are safe to import from any extension surface
// (content / sidepanel / background). Types are similarly portable and
// are referenced by `shared/messages.ts` for the SECRETS_* message
// payloads.

// --- Types --------------------------------------------------------------

// 1.2 — KDF parameter type. Only PBKDF2-SHA256 today; declaring the shape
// as a tagged union with a single tag keeps the door open for Argon2id
// without touching call sites that pass around `KdfParams` opaquely. When
// Argon2id lands, extend the union rather than adding booleans.
export type KdfParams = {
  algorithm: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
};

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};

export type SecretVaultRecord = EncryptedBlob & {
  updatedAt: number;
};

// Vault payload version is currently 2. v1 vaults (pre-1.2) are still
// readable via LEGACY_KDF_PARAMS in secretsVault.ts and migrate silently.
// This type is the in-memory normalized shape; on-disk v1 vaults are
// coerced to this shape with kdf filled in.
export type SecretVaultPayload = {
  version: 2;
  kdf: KdfParams;
  salt: string;
  verifier: EncryptedBlob;
  items: Record<string, SecretVaultRecord>;
};

export type SecretVaultStatus = {
  configured: boolean;
  unlocked: boolean;
  secretCount: number;
  names: string[];
};

export const SECRET_VAULT_TRANSFER_VERSION = 'ladybird-secrets-transfer-v1' as const;

export type SecretVaultTransferPayload = {
  version: typeof SECRET_VAULT_TRANSFER_VERSION;
  items: Record<string, string>;
};

// --- Token regex + pure helpers -----------------------------------------

// Exported so secretsVault.ts can reuse the SAME pattern for
// resolveSecretTokens. Keeping it in one place prevents regex drift
// between "is this a secret token?" checks and the resolve path.
export const SECRET_TOKEN_PATTERN =
  /{{\s*secret(?:\.([A-Za-z0-9_.:-]+)|\[\s*["']([^"']+)["']\s*\])\s*}}/g;
const SECRET_TOKEN_EXACT_PATTERN =
  /^\{\{\s*secret(?:\.([A-Za-z0-9_.:-]+)|\[\s*["']([^"']+)["']\s*\])\s*\}\}$/;

export const parseSecretTokenValue = (value: string): { name: string } | null => {
  const match = SECRET_TOKEN_EXACT_PATTERN.exec(value || '');
  const name = match?.[1] || match?.[2];
  return name ? { name } : null;
};

export const isSecretTokenValue = (value: string): boolean => Boolean(parseSecretTokenValue(value));

export const buildSecretToken = (name: string): string => {
  const normalized = name.trim();
  if (/^[A-Za-z0-9_:-]+$/.test(normalized)) {
    return `{{secret.${normalized}}}`;
  }
  const escaped = normalized.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `{{secret["${escaped}"]}}`;
};

// --- Transfer payload parser (pure) -------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const parseSecretVaultTransferPayload = (raw: unknown): SecretVaultTransferPayload | null => {
  if (!isRecord(raw) || raw.version !== SECRET_VAULT_TRANSFER_VERSION || !isRecord(raw.items)) {
    return null;
  }
  const items: Record<string, string> = {};
  Object.entries(raw.items).forEach(([name, value]) => {
    if (typeof value !== 'string') {
      return;
    }
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }
    items[normalizedName] = value;
  });
  return {
    version: SECRET_VAULT_TRANSFER_VERSION,
    items,
  };
};
