const SECRETS_VAULT_KEY = 'ladybird_secrets_v1';
const SECRETS_SESSION_KEY = 'ladybird_secrets_session_v1';
// 1.2 — bumped from 1 to 2. v2 vaults carry an inline `kdf` object so the
// algorithm/iterations can evolve via data-format migration (rather than
// requiring a code release every time the target changes). Legacy v1 vaults
// on disk are read back as if they had `kdf: LEGACY_KDF_PARAMS` and then
// silently upgraded to v2 on the next successful unlock (see
// `tryMigrateVaultToCurrentKdf`). The storage key string stays
// `ladybird_secrets_v1` — that's just the chrome.storage key identifier,
// not the payload version; renaming it would strand existing users.
const VAULT_VERSION = 2 as const;
const VERIFIER_PLAINTEXT = 'ladybird-secret-v1';
export const SECRET_VAULT_TRANSFER_VERSION = 'ladybird-secrets-transfer-v1' as const;
const SECRET_TOKEN_PATTERN =
  /{{\s*secret(?:\.([A-Za-z0-9_.:-]+)|\[\s*["']([^"']+)["']\s*\])\s*}}/g;
const SECRET_TOKEN_EXACT_PATTERN =
  /^\{\{\s*secret(?:\.([A-Za-z0-9_.:-]+)|\[\s*["']([^"']+)["']\s*\])\s*\}\}$/;

// 1.2 — KDF parameter type. Only PBKDF2-SHA256 today; declaring the shape
// as a tagged union with a single tag keeps the door open for Argon2id
// without touching call sites that pass around `KdfParams` opaquely. When
// Argon2id lands, extend the union rather than adding booleans.
type KdfParams = {
  algorithm: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
};

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
// vault (derive a different AES key, fail verifier, user is told their
// password is wrong). A future vault-format batch may retire legacy
// support, at which point this constant plus the `raw.version === 1`
// branch in `normalizeVaultPayload` can be deleted together.
const LEGACY_KDF_PARAMS: KdfParams = {
  algorithm: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 200_000,
};

const isSameKdfParams = (a: KdfParams, b: KdfParams) =>
  a.algorithm === b.algorithm && a.hash === b.hash && a.iterations === b.iterations;

type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};

type SecretVaultRecord = EncryptedBlob & {
  updatedAt: number;
};

type SecretVaultPayload = {
  version: typeof VAULT_VERSION;
  // 1.2 — in-memory kdf is always populated. Vault objects read from a v1
  // format have kdf filled in as LEGACY_KDF_PARAMS during normalize; this
  // guarantees `deriveAesKeyFromPassword(password, salt, vault.kdf)` is
  // always a valid call regardless of on-disk version.
  kdf: KdfParams;
  salt: string;
  verifier: EncryptedBlob;
  items: Record<string, SecretVaultRecord>;
};

type SecretSessionPayload = {
  version: typeof VAULT_VERSION;
  salt: string;
  key: string;
  unlockedAt: number;
};

type SecretVaultStatus = {
  configured: boolean;
  unlocked: boolean;
  secretCount: number;
  names: string[];
};

export type SecretVaultTransferPayload = {
  version: typeof SECRET_VAULT_TRANSFER_VERSION;
  items: Record<string, string>;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

const getStorageSession = () => {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    return chrome.storage.session;
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

// 1.2 — Normalize the on-disk kdf field. Accepts only shapes we know we can
// derive a key for. Rejecting unknown shapes here means a future vault with
// algorithm we don't support lands as "unreadable" rather than silently
// mis-derived.
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
  // 1.2 — v2 vaults require a valid `kdf` object; v1 vaults (pre-1.2) lack
  // the field and get LEGACY_KDF_PARAMS applied. Any other version or
  // malformed kdf is treated as unreadable (returns null → caller sees
  // "vault not configured" rather than getting confused about which KDF
  // to try).
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

const normalizeSessionPayload = (raw: unknown): SecretSessionPayload | null => {
  if (!isRecord(raw)) {
    return null;
  }
  if (raw.version !== VAULT_VERSION) {
    return null;
  }
  if (typeof raw.salt !== 'string' || typeof raw.key !== 'string') {
    return null;
  }
  const unlockedAt =
    typeof raw.unlockedAt === 'number' && Number.isFinite(raw.unlockedAt) ? raw.unlockedAt : Date.now();
  return {
    version: VAULT_VERSION,
    salt: raw.salt,
    key: raw.key,
    unlockedAt,
  };
};

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

const readSessionPayload = async (): Promise<SecretSessionPayload | null> => {
  const storage = getStorageSession();
  if (storage) {
    const result = await storage.get(SECRETS_SESSION_KEY);
    return normalizeSessionPayload(result?.[SECRETS_SESSION_KEY]);
  }
  return null;
};

const writeSessionPayload = async (payload: SecretSessionPayload) => {
  const storage = getStorageSession();
  if (storage) {
    await storage.set({ [SECRETS_SESSION_KEY]: payload });
  }
};

export const lockSecretsVault = async () => {
  const storage = getStorageSession();
  if (storage) {
    await storage.remove(SECRETS_SESSION_KEY);
  }
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
  await lockSecretsVault();
  return {
    configured: false,
    unlocked: false,
    secretCount: 0,
    names: [],
  };
};

// 1.2 — KDF params now flow through as an argument rather than hardcoded
// constants. Callers read `vault.kdf` when working with an existing vault
// (so an unmigrated v1 vault keeps using LEGACY_KDF_PARAMS for unlock)
// and pass `CURRENT_KDF_PARAMS` when creating/migrating.
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
    true,
    ['encrypt', 'decrypt'],
  );
};

const importAesKeyFromRaw = async (rawKey: Uint8Array) =>
  crypto.subtle.importKey('raw', toCryptoBuffer(rawKey), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

const exportAesKeyRaw = async (key: CryptoKey) => new Uint8Array(await crypto.subtle.exportKey('raw', key));

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
// Runs after the password has been verified in `unlockSecretsVault`.
// Design: unlock correctness takes priority — if ANY step of migration
// fails (item decrypt, item encrypt, vault write), we log and return
// null, and the caller keeps using the existing (unmigrated) vault and
// its key. Next unlock retries. This matches the 2.7 read-path principle:
// an optional upgrade must never degrade the main operation.
//
// Ordering: new vault is written in a single `writeVaultPayload` call
// (atomic key-level set in chrome.storage). The old vault stays intact on
// disk until that single write succeeds — there is no partial state.
// Session update happens AFTER this function returns, in the caller.
// Between the vault write and the session update, a concurrent call to
// `getUnlockedKeyForVault` observes new-vault-salt vs old-session-salt,
// returns null, and the operation fails closed (user re-unlocks); it
// cannot decrypt with a mismatched key.
//
// Salt is rotated (new 16 bytes) because rotating on KDF-param change
// costs nothing and avoids carrying a salt that was sized/chosen under
// the old parameter regime.
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

const getUnlockedKeyForVault = async (vault: SecretVaultPayload): Promise<CryptoKey | null> => {
  const session = await readSessionPayload();
  if (!session || session.salt !== vault.salt) {
    return null;
  }
  try {
    return await importAesKeyFromRaw(fromBase64(session.key));
  } catch {
    return null;
  }
};

const persistUnlockedKey = async (vaultSalt: string, key: CryptoKey) => {
  const rawKey = await exportAesKeyRaw(key);
  await writeSessionPayload({
    version: VAULT_VERSION,
    salt: vaultSalt,
    key: toBase64(rawKey),
    unlockedAt: Date.now(),
  });
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
  const unlocked = Boolean(await getUnlockedKeyForVault(vault));
  const names = sortSecretNames(Object.keys(vault.items || {}));
  return {
    configured: true,
    unlocked,
    secretCount: names.length,
    names,
  };
};

export const listSecretNames = async (): Promise<string[]> => {
  const status = await getSecretsVaultStatus();
  return status.names;
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
    // and verifier in this vault were encrypted against. Using current
    // kdf here would fail the verifier check for every legacy vault.
    key = await deriveAesKeyFromPassword(trimmed, fromBase64(vault.salt), vault.kdf);
    try {
      const verifier = await decryptString(key, vault.verifier);
      if (verifier !== VERIFIER_PLAINTEXT) {
        throw new Error('invalid-verifier');
      }
    } catch {
      throw new Error('Invalid master password.');
    }
    // 1.2 — password is verified. Attempt silent KDF upgrade if the vault
    // is behind CURRENT_KDF_PARAMS. Migration is best-effort; if it fails
    // for any reason (quota, storage error, an item that won't decrypt),
    // we fall through with the old vault + old key so the user still gets
    // a successful unlock. Next unlock retries the migration. Per user
    // review of 1.2 design: "migration is best-effort; unlock correctness
    // first" — matches the read-path principle established in 2.7.
    if (!isSameKdfParams(vault.kdf, CURRENT_KDF_PARAMS)) {
      const migrated = await tryMigrateVaultToCurrentKdf(vault, trimmed);
      if (migrated) {
        vault = migrated.vault;
        key = migrated.key;
      }
      // migrated === null → keep old vault + old key, session below uses
      // the old salt. Nothing on disk has changed in this branch.
    }
  }
  await persistUnlockedKey(vault.salt, key);
  return getSecretsVaultStatus();
};

const requireUnlockedVault = async () => {
  const vault = await readVaultPayload();
  if (!vault) {
    throw new Error('Secret vault is not configured.');
  }
  const key = await getUnlockedKeyForVault(vault);
  if (!key) {
    throw new Error('Secret vault is locked.');
  }
  return { vault, key };
};

const normalizeSecretName = (name: string) => name.trim();

export const upsertSecretValue = async (name: string, value: string) => {
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

export const deleteSecretValue = async (name: string) => {
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
