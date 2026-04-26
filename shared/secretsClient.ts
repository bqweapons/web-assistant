// 1.1 — Sidepanel / content-side client for the vault operations. Thin
// wrapper around `sendRuntimeMessage`; the API surface mirrors the
// `entrypoints/background/secretsVault.ts` exports so swapping the old
// `shared/secrets` imports for this client is a direct renaming at most
// call sites. The one behavior difference callers must handle: because
// the vault key lives only in SW memory (see 1.1 design), an SW restart
// between calls can cause a previously-unlocked vault to report locked;
// callers that show vault-state UI should refresh status on focus /
// interaction rather than caching an "unlocked" bit across long idle.
//
// This file must NOT import from `entrypoints/background/secretsVault.ts`
// — that path is SW-only. Importing it into a sidepanel bundle would drag
// the actual crypto code into the sidepanel realm, defeating 1.1.

import { MessageType, type SecretsMessageResponse } from './messages';
import { sendRuntimeMessage } from './runtimeMessaging';
import type { SecretVaultStatus, SecretVaultTransferPayload } from './secrets';

export const getSecretsVaultStatus = async (): Promise<SecretVaultStatus> => {
  return sendRuntimeMessage<SecretsMessageResponse[typeof MessageType.SECRETS_STATUS]>({
    type: MessageType.SECRETS_STATUS,
  });
};

export const unlockSecretsVault = async (password: string): Promise<SecretVaultStatus> => {
  return sendRuntimeMessage<SecretsMessageResponse[typeof MessageType.SECRETS_UNLOCK]>({
    type: MessageType.SECRETS_UNLOCK,
    data: { password },
  });
};

export const lockSecretsVault = async (): Promise<void> => {
  await sendRuntimeMessage({
    type: MessageType.SECRETS_LOCK,
  });
};

export const resetSecretsVault = async (): Promise<SecretVaultStatus> => {
  return sendRuntimeMessage<SecretsMessageResponse[typeof MessageType.SECRETS_RESET]>({
    type: MessageType.SECRETS_RESET,
  });
};

export const resolveSecretValue = async (name: string): Promise<string> => {
  const response = await sendRuntimeMessage<SecretsMessageResponse[typeof MessageType.SECRETS_RESOLVE]>({
    type: MessageType.SECRETS_RESOLVE,
    data: { name },
  });
  return response.value;
};

export const upsertSecretValue = async (name: string, value: string): Promise<SecretVaultStatus> => {
  return sendRuntimeMessage<SecretsMessageResponse[typeof MessageType.SECRETS_UPSERT]>({
    type: MessageType.SECRETS_UPSERT,
    data: { name, value },
  });
};

export const deleteSecretValue = async (name: string): Promise<SecretVaultStatus> => {
  return sendRuntimeMessage<SecretsMessageResponse[typeof MessageType.SECRETS_DELETE]>({
    type: MessageType.SECRETS_DELETE,
    data: { name },
  });
};

export const exportSecretVaultTransferPayload = async (
  password: string,
): Promise<SecretVaultTransferPayload | null> => {
  return sendRuntimeMessage<SecretsMessageResponse[typeof MessageType.SECRETS_EXPORT_TRANSFER]>({
    type: MessageType.SECRETS_EXPORT_TRANSFER,
    data: { password },
  });
};

export const importSecretVaultTransferPayload = async (
  payload: SecretVaultTransferPayload,
  password: string,
): Promise<SecretVaultStatus> => {
  return sendRuntimeMessage<SecretsMessageResponse[typeof MessageType.SECRETS_IMPORT_TRANSFER]>({
    type: MessageType.SECRETS_IMPORT_TRANSFER,
    data: { payload, password },
  });
};
