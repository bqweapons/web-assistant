// 1.1 — SW-only vault state + operations. The AES-GCM derived key lives in
// this module's memory as a non-extractable `CryptoKey` and NEVER leaves
// the SW realm. When the SW is suspended, the key is lost — the user
// must re-enter the master password on the next unlock. That is the
// explicit product semantic of 1.1: **SW suspend == vault locked**.
// There is no on-disk persistence of the key (not in `chrome.storage.local`,
// not in `chrome.storage.session`, not anywhere) — session persistence
// would require the key to be extractable as raw bytes, which defeats the
// guarantee 1.1 is trying to establish.
//
// Access pattern:
// - Sidepanel / content surfaces → `shared/secretsClient.ts` (message-based)
//   → `bootstrap.ts` handler → this module.
// - Background code (e.g. `stepExecution.ts`) → imports directly from here.
//
// The on-disk vault (encrypted items + salt + verifier) still lives in
// `chrome.storage.local` under `SECRETS_VAULT_KEY`; that's unchanged from
// the pre-1.1 design and is not a 1.1 concern.

import {
  SECRET_TOKEN_PATTERN,
  SECRET_VAULT_TRANSFER_VERSION,
  parseSecretVaultTransferPayload,
  type EncryptedBlob,
  type KdfParams,
  type SecretVaultPayload,
  type SecretVaultRecord,
  type SecretVaultStatus,
  type SecretVaultTransferPayload,
} from '../../shared/secrets';

const SECRETS_VAULT_KEY = 'ladybird_secrets_v1';
const VAULT_VERSION = 2 as const;
const VERIFIER_PLAINTEXT = 'ladybird-secret-v1';

// 1.2 — CURRENT is what fresh vaults and completed migrations use. OWASP
// ASVS 2023 / Bitwarden 2023 default is PBKDF2-SHA256 at 600k iterations.
// Desktop unlock latency lands around 300-500ms.
const CURRENT_KDF_PARAMS: KdfParams = {
  algorithm: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 600_000,
};

// 1.2 — LEGACY mirrors the pre-1.2 hardcoded values. This constant is the
// ONLY correct way to decrypt a v1 vault that's still on disk. Do NOT
// change these numbers — doing so would silently misinterpret every v1
// vault. A future vault-format batch may retire legacy support together
// with the `raw.version === 1` branch in `normalizeVaultPayload`.
const LEGACY_KDF_PARAMS: KdfParams = {
  algorithm: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 200_000,
};

const isSameKdfParams = (a: KdfParams, b: KdfParams) =>
  a.algorithm === b.algorithm && a.hash === b.hash && a.iterations === b.iterations;

// 1.1 — SW-memory unlocked-key state. `unlockedKey` is a non-extractable
// CryptoKey; `unlockedSalt` is the salt from the vault that key was
// derived against (used to detect mismatch when the vault is migrated
// mid-session, e.g. salt rotation during KDF upgrade). Both reset to
// null on SW cold start.
let unlockedKey: CryptoKey | null = null;
let unlockedSalt: string | null = null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const fromBase64 = (input: string) => {
  const normalized = (input || '').trim();
  if (!normalized) {
    return new Uint8Array();
  }
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getStorageLocal = () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  return null;
};

const getRandomBytes = (length: number) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

const toCryptoBuffer = (bytes: Uint8Array) => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const normalizeEncryptedBlob = (value: unknown): EncryptedBlob | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.iv !== 'string' || typeof value.ciphertext !== 'string') {
    return null;
  }
  return { iv: value.iv, ciphertext: value.ciphertext };
};

const normalizeKdfParams = (value: unknown): KdfParams | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (value.algorithm !== 'PBKDF2' || value.hash !== 'SHA-256') {
    return null;
  }
  if (
    typeof value.iterations !== 'number' ||
    !Number.isFinite(value.iterations) ||
    value.iterations < 1
  ) {
    return null;
  }
  return {
    algorithm: 'PBKDF2',
    hash: 'SHA-256',
    iterations: Math.floor(value.iterations),
  };
};

const normalizeVaultPayload = (raw: unknown): SecretVaultPayload | null => {
  if (!isRecord(raw)) {
    return null;
  }
  if (typeof raw.salt !== 'string') {
    return null;
  }
  const verifier = normalizeEncryptedBlob(raw.verifier);
  if (!verifier) {
    return null;
  }
  let kdf: KdfParams | null = null;
  if (raw.version === 2) {
    kdf = normalizeKdfParams(raw.kdf);
  } else if (raw.version === 1) {
    kdf = LEGACY_KDF_PARAMS;
  }
  if (!kdf) {
    return null;
  }
  const rawItems = isRecord(raw.items) ? raw.items : {};
  const items: Record<string, SecretVaultRecord> = {};
  Object.entries(rawItems).forEach(([key, value]) => {
    const normalized = normalizeEncryptedBlob(value);
    if (!normalized) {
      return;
    }
    const updatedAt =
      isRecord(value) && typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
        ? value.updatedAt
        : Date.now();
    items[key] = { ...normalized, updatedAt };
  });
  return {
    version: VAULT_VERSION,
    kdf,
    salt: raw.salt,
    verifier,
    items,
  };
};

const readVaultPayload = async (): Promise<SecretVaultPayload | null> => {
  const storage = getStorageLocal();
  if (storage) {
    const result = await storage.get(SECRETS_VAULT_KEY);
    return normalizeVaultPayload(result?.[SECRETS_VAULT_KEY]);
  }
  try {
    const raw = localStorage.getItem(SECRETS_VAULT_KEY);
    return normalizeVaultPayload(raw ? (JSON.parse(raw) as unknown) : null);
  } catch {
    return null;
  }
};

const writeVaultPayload = async (payload: SecretVaultPayload) => {
  const storage = getStorageLocal();
  if (storage) {
    await storage.set({ [SECRETS_VAULT_KEY]: payload });
    return;
  }
  localStorage.setItem(SECRETS_VAULT_KEY, JSON.stringify(payload));
};

// 1.1 — `extractable: false`. The derived key cannot be round-tripped to
// raw bytes. `crypto.subtle.exportKey(..., key)` throws for a
// non-extractable key. This is the mechanical difference that enforces
// "no persistence" at the WebCrypto layer: even if someone adds a
// "persist the key" line elsewhere, the export call fails.
const deriveAesKeyFromPassword = async (
  password: string,
  salt: Uint8Array,
  kdf: KdfParams,
) => {
  const material = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    kdf.algorithm,
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: kdf.algorithm,
      salt: toCryptoBuffer(salt),
      iterations: kdf.iterations,
      hash: kdf.hash,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

const encryptString = async (key: CryptoKey, plaintext: string): Promise<EncryptedBlob> => {
  const iv = getRandomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(plaintext),
  );
  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
};

const decryptString = async (key: CryptoKey, blob: EncryptedBlob): Promise<string> => {
  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.ciphertext);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return textDecoder.decode(plaintext);
};

const buildEmptyVault = async (
  key: CryptoKey,
  saltBytes: Uint8Array,
  kdf: KdfParams,
): Promise<SecretVaultPayload> => ({
  version: VAULT_VERSION,
  kdf,
  salt: toBase64(saltBytes),
  verifier: await encryptString(key, VERIFIER_PLAINTEXT),
  items: {},
});

// 1.2 — Silent best-effort upgrade of a vault's KDF to CURRENT_KDF_PARAMS.
// Same contract as pre-1.1: migration is best-effort; if it fails the
// outer unlock still succeeds with the old vault + old key, and the
// user can retry on next unlock.
const tryMigrateVaultToCurrentKdf = async (
  vault: SecretVaultPayload,
  password: string,
): Promise<{ vault: SecretVaultPayload; key: CryptoKey } | null> => {
  try {
    const newSaltBytes = getRandomBytes(16);
    const newKey = await deriveAesKeyFromPassword(password, newSaltBytes, CURRENT_KDF_PARAMS);
    const oldKey = await deriveAesKeyFromPassword(password, fromBase64(vault.salt), vault.kdf);
    const newItems: Record<string, SecretVaultRecord> = {};
    for (const [name, record] of Object.entries(vault.items)) {
      const plaintext = await decryptString(oldKey, record);
      const encrypted = await encryptString(newKey, plaintext);
      newItems[name] = { ...encrypted, updatedAt: record.updatedAt };
    }
    const newVerifier = await encryptString(newKey, VERIFIER_PLAINTEXT);
    const newVault: SecretVaultPayload = {
      version: VAULT_VERSION,
      kdf: CURRENT_KDF_PARAMS,
      salt: toBase64(newSaltBytes),
      verifier: newVerifier,
      items: newItems,
    };
    await writeVaultPayload(newVault);
    return { vault: newVault, key: newKey };
  } catch (error) {
    console.warn('vault-kdf-migration-failed', error);
    return null;
  }
};

// 1.1 — Returns the currently-unlocked key ONLY if its associated salt
// matches the vault's current salt. A salt mismatch means the vault was
// migrated (salt rotated) but the in-memory unlocked state is stale;
// the caller treats this as "locked" and forces a re-unlock.
const getUnlockedKeyForVault = (vault: SecretVaultPayload): CryptoKey | null => {
  if (!unlockedKey || !unlockedSalt) {
    return null;
  }
  if (unlockedSalt !== vault.salt) {
    return null;
  }
  return unlockedKey;
};

const setUnlockedState = (vaultSalt: string, key: CryptoKey) => {
  unlockedKey = key;
  unlockedSalt = vaultSalt;
};

const clearUnlockedState = () => {
  unlockedKey = null;
  unlockedSalt = null;
};

const sortSecretNames = (names: string[]) => names.sort((a, b) => a.localeCompare(b));

export const getSecretsVaultStatus = async (): Promise<SecretVaultStatus> => {
  const vault = await readVaultPayload();
  if (!vault) {
    return {
      configured: false,
      unlocked: false,
      secretCount: 0,
      names: [],
    };
  }
  const unlocked = Boolean(getUnlockedKeyForVault(vault));
  const names = sortSecretNames(Object.keys(vault.items || {}));
  return {
    configured: true,
    unlocked,
    secretCount: names.length,
    names,
  };
};

export const lockSecretsVault = async (): Promise<void> => {
  clearUnlockedState();
};

export const resetSecretsVault = async (): Promise<SecretVaultStatus> => {
  const local = getStorageLocal();
  if (local) {
    await local.remove(SECRETS_VAULT_KEY);
  } else {
    try {
      localStorage.removeItem(SECRETS_VAULT_KEY);
    } catch {
      // ignore local fallback removal failures
    }
  }
  clearUnlockedState();
  return {
    configured: false,
    unlocked: false,
    secretCount: 0,
    names: [],
  };
};

export const unlockSecretsVault = async (password: string): Promise<SecretVaultStatus> => {
  const trimmed = password;
  if (!trimmed) {
    throw new Error('Master password is required.');
  }
  let vault = await readVaultPayload();
  let key: CryptoKey;
  if (!vault) {
    // Fresh vault → always uses CURRENT_KDF_PARAMS. No migration consideration.
    const saltBytes = getRandomBytes(16);
    key = await deriveAesKeyFromPassword(trimmed, saltBytes, CURRENT_KDF_PARAMS);
    vault = await buildEmptyVault(key, saltBytes, CURRENT_KDF_PARAMS);
    await writeVaultPayload(vault);
  } else {
    // 1.2 — derive with STORED kdf (not current). That's what the items
    // and verifier in this vault were encrypted against.
    key = await deriveAesKeyFromPassword(trimmed, fromBase64(vault.salt), vault.kdf);
    try {
      const verifier = await decryptString(key, vault.verifier);
      if (verifier !== VERIFIER_PLAINTEXT) {
        throw new Error('invalid-verifier');
      }
    } catch {
      throw new Error('Invalid master password.');
    }
    // 1.2 — silent KDF upgrade. Best-effort: if migration fails, fall
    // through with the old vault + old key and still succeed the unlock.
    if (!isSameKdfParams(vault.kdf, CURRENT_KDF_PARAMS)) {
      const migrated = await tryMigrateVaultToCurrentKdf(vault, trimmed);
      if (migrated) {
        vault = migrated.vault;
        key = migrated.key;
      }
    }
  }
  // 1.1 — store the non-extractable key directly in SW memory. No session
  // persistence; no raw-bytes export. SW suspension clears this state.
  setUnlockedState(vault.salt, key);
  return getSecretsVaultStatus();
};

const requireUnlockedVault = async () => {
  const vault = await readVaultPayload();
  if (!vault) {
    throw new Error('Secret vault is not configured.');
  }
  const key = getUnlockedKeyForVault(vault);
  if (!key) {
    throw new Error('Secret vault is locked.');
  }
  return { vault, key };
};

const normalizeSecretName = (name: string) => name.trim();

export const upsertSecretValue = async (name: string, value: string): Promise<SecretVaultStatus> => {
  const normalizedName = normalizeSecretName(name);
  if (!normalizedName) {
    throw new Error('Secret name is required.');
  }
  const { vault, key } = await requireUnlockedVault();
  const encrypted = await encryptString(key, value);
  const nextVault: SecretVaultPayload = {
    ...vault,
    items: {
      ...vault.items,
      [normalizedName]: {
        ...encrypted,
        updatedAt: Date.now(),
      },
    },
  };
  await writeVaultPayload(nextVault);
  return getSecretsVaultStatus();
};

export const deleteSecretValue = async (name: string): Promise<SecretVaultStatus> => {
  const normalizedName = normalizeSecretName(name);
  const { vault } = await requireUnlockedVault();
  if (!normalizedName || !(normalizedName in vault.items)) {
    return getSecretsVaultStatus();
  }
  const nextItems = { ...vault.items };
  delete nextItems[normalizedName];
  await writeVaultPayload({ ...vault, items: nextItems });
  return getSecretsVaultStatus();
};

export const resolveSecretValue = async (name: string): Promise<string> => {
  const normalizedName = normalizeSecretName(name);
  if (!normalizedName) {
    throw new Error('Secret name is required.');
  }
  const { vault, key } = await requireUnlockedVault();
  const record = vault.items[normalizedName];
  if (!record) {
    throw new Error(`Secret not found: ${normalizedName}`);
  }
  return decryptString(key, record);
};

export const resolveSecretTokens = async (input: string): Promise<string> => {
  if (!input || !SECRET_TOKEN_PATTERN.test(input)) {
    SECRET_TOKEN_PATTERN.lastIndex = 0;
    return input;
  }
  SECRET_TOKEN_PATTERN.lastIndex = 0;
  const matches = Array.from(input.matchAll(SECRET_TOKEN_PATTERN));
  if (matches.length === 0) {
    return input;
  }
  const uniqueNames = Array.from(new Set(matches.map((match) => match[1] || match[2]).filter(Boolean)));
  const resolved = new Map<string, string>();
  for (const name of uniqueNames) {
    resolved.set(name, await resolveSecretValue(name));
  }
  return input.replace(
    SECRET_TOKEN_PATTERN,
    (_full, dotName: string | undefined, bracketName: string | undefined) =>
      resolved.get(dotName || bracketName || '') ?? '',
  );
};

export const exportSecretVaultTransferPayload = async (
  masterPassword: string,
): Promise<SecretVaultTransferPayload | null> => {
  const existingVault = await readVaultPayload();
  if (!existingVault) {
    return null;
  }
  const unlockedStatus = await unlockSecretsVault(masterPassword);
  const items: Record<string, string> = {};
  for (const name of unlockedStatus.names) {
    items[name] = await resolveSecretValue(name);
  }
  return {
    version: SECRET_VAULT_TRANSFER_VERSION,
    items,
  };
};

export const importSecretVaultTransferPayload = async (
  payload: SecretVaultTransferPayload,
  vaultPassword: string,
): Promise<SecretVaultStatus> => {
  const parsed = parseSecretVaultTransferPayload(payload);
  if (!parsed) {
    throw new Error('Invalid secret vault transfer payload.');
  }
  await unlockSecretsVault(vaultPassword);
  for (const [name, value] of Object.entries(parsed.items)) {
    await upsertSecretValue(name, value);
  }
  return getSecretsVaultStatus();
};
