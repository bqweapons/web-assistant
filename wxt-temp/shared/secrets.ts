const SECRETS_VAULT_KEY = 'ladybird_secrets_v1';
const SECRETS_SESSION_KEY = 'ladybird_secrets_session_v1';
const VAULT_VERSION = 1 as const;
const VERIFIER_PLAINTEXT = 'ladybird-secret-v1';
const PBKDF2_ITERATIONS = 200_000;
const SECRET_TOKEN_PATTERN = /{{\s*secret\.([A-Za-z0-9_.:-]+)\s*}}/g;

type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};

type SecretVaultRecord = EncryptedBlob & {
  updatedAt: number;
};

type SecretVaultPayload = {
  version: typeof VAULT_VERSION;
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

const normalizeVaultPayload = (raw: unknown): SecretVaultPayload | null => {
  if (!isRecord(raw)) {
    return null;
  }
  if (raw.version !== VAULT_VERSION || typeof raw.salt !== 'string') {
    return null;
  }
  const verifier = normalizeEncryptedBlob(raw.verifier);
  if (!verifier) {
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

const deriveAesKeyFromPassword = async (password: string, salt: Uint8Array) => {
  const material = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toCryptoBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
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

const buildEmptyVault = async (key: CryptoKey, saltBytes: Uint8Array): Promise<SecretVaultPayload> => ({
  version: VAULT_VERSION,
  salt: toBase64(saltBytes),
  verifier: await encryptString(key, VERIFIER_PLAINTEXT),
  items: {},
});

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

export const unlockSecretsVault = async (password: string): Promise<SecretVaultStatus> => {
  const trimmed = password;
  if (!trimmed) {
    throw new Error('Master password is required.');
  }
  let vault = await readVaultPayload();
  let key: CryptoKey;
  if (!vault) {
    const saltBytes = getRandomBytes(16);
    key = await deriveAesKeyFromPassword(trimmed, saltBytes);
    vault = await buildEmptyVault(key, saltBytes);
    await writeVaultPayload(vault);
  } else {
    key = await deriveAesKeyFromPassword(trimmed, fromBase64(vault.salt));
    try {
      const verifier = await decryptString(key, vault.verifier);
      if (verifier !== VERIFIER_PLAINTEXT) {
        throw new Error('invalid-verifier');
      }
    } catch {
      throw new Error('Invalid master password.');
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
  const uniqueNames = Array.from(new Set(matches.map((match) => match[1])));
  const resolved = new Map<string, string>();
  for (const name of uniqueNames) {
    resolved.set(name, await resolveSecretValue(name));
  }
  return input.replace(SECRET_TOKEN_PATTERN, (_full, name: string) => resolved.get(name) ?? '');
};
