import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, Pencil, Trash2, Unlock, X } from 'lucide-react';
import {
  deleteSecretValue,
  getSecretsVaultStatus,
  resetSecretsVault,
  resolveSecretValue,
  unlockSecretsVault,
  upsertSecretValue,
} from '../../../shared/secrets';
import Card from './Card';
import ConfirmDialog from './ConfirmDialog';
import { t } from '../utils/i18n';

type VaultStatus = {
  configured: boolean;
  unlocked: boolean;
  secretCount: number;
  names: string[];
};

type SecretEditorState = {
  mode: 'create' | 'edit';
  originalName?: string;
  name: string;
  value: string;
};

const DEFAULT_VAULT_STATUS: VaultStatus = {
  configured: false,
  unlocked: false,
  secretCount: 0,
  names: [],
};

export default function PasswordVaultManager() {
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>(DEFAULT_VAULT_STATUS);
  const [vaultPasswordInput, setVaultPasswordInput] = useState('');
  const [isVaultBusy, setIsVaultBusy] = useState(false);
  const [vaultFeedback, setVaultFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [revealedVaultValues, setRevealedVaultValues] = useState<Record<string, string>>({});
  const [revealingSecretName, setRevealingSecretName] = useState<string | null>(null);
  const [isVaultViewerOpen, setIsVaultViewerOpen] = useState(false);
  const [editingSecretName, setEditingSecretName] = useState<string | null>(null);
  const [pendingDeleteSecretName, setPendingDeleteSecretName] = useState('');
  const [secretEditor, setSecretEditor] = useState<SecretEditorState | null>(null);

  const refreshVaultStatus = async () => {
    const status = await getSecretsVaultStatus();
    setVaultStatus({
      configured: status.configured,
      unlocked: status.unlocked,
      secretCount: status.secretCount,
      names: status.names,
    });
    if (!status.unlocked) {
      setRevealedVaultValues({});
      setRevealingSecretName(null);
      setEditingSecretName(null);
      setPendingDeleteSecretName('');
      setSecretEditor(null);
    }
  };

  useEffect(() => {
    void refreshVaultStatus().catch(() => {
      // Non-blocking: settings page should still load even if vault status can't be read.
    });
  }, []);

  const handleUnlockOrCreateVault = async () => {
    if (!vaultPasswordInput || isVaultBusy) {
      return;
    }
    setIsVaultBusy(true);
    setVaultFeedback(null);
    try {
      const status = await unlockSecretsVault(vaultPasswordInput);
      setVaultStatus({
        configured: status.configured,
        unlocked: status.unlocked,
        secretCount: status.secretCount,
        names: status.names,
      });
      setVaultPasswordInput('');
      setVaultFeedback({
        type: 'success',
        message: status.configured
          ? t('sidepanel_settings_vault_viewer_unlocked', 'Password vault unlocked.')
          : t('sidepanel_settings_vault_viewer_created', 'Password vault created and unlocked.'),
      });
    } catch (error) {
      setVaultFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsVaultBusy(false);
    }
  };

  const handleToggleRevealSecret = async (name: string) => {
    if (revealedVaultValues[name]) {
      setRevealedVaultValues((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
      return;
    }
    if (!vaultStatus.unlocked || revealingSecretName || isVaultBusy) {
      return;
    }
    setRevealingSecretName(name);
    setVaultFeedback(null);
    try {
      const value = await resolveSecretValue(name);
      setRevealedVaultValues((current) => ({ ...current, [name]: value }));
    } catch (error) {
      setVaultFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRevealingSecretName(null);
    }
  };

  const handleOpenVaultViewer = async () => {
    setVaultFeedback(null);
    await refreshVaultStatus().catch(() => {
      // Ignore status refresh failures here; the modal can still open.
    });
    setIsVaultViewerOpen(true);
  };

  const handleCloseVaultViewer = () => {
    setIsVaultViewerOpen(false);
    setVaultPasswordInput('');
    setVaultFeedback(null);
    setRevealedVaultValues({});
    setRevealingSecretName(null);
    setEditingSecretName(null);
    setPendingDeleteSecretName('');
    setSecretEditor(null);
  };

  const handleResetVault = async () => {
    if (isVaultBusy) {
      return;
    }
    const confirmed = window.confirm(
      t(
        'sidepanel_settings_vault_viewer_reset_confirm',
        'Forgot your vault password?\n\nResetting the vault will permanently delete all saved passwords in the vault. Flows that use saved passwords will need to be rebound.\n\nDo you want to reset the vault?',
      ),
    );
    if (!confirmed) {
      return;
    }
    setIsVaultBusy(true);
    setVaultFeedback(null);
    try {
      const status = await resetSecretsVault();
      setVaultStatus({
        configured: status.configured,
        unlocked: status.unlocked,
        secretCount: status.secretCount,
        names: status.names,
      });
      setVaultPasswordInput('');
      setRevealedVaultValues({});
      setRevealingSecretName(null);
      setEditingSecretName(null);
      setPendingDeleteSecretName('');
      setSecretEditor(null);
      setVaultFeedback({
        type: 'success',
        message: t(
          'sidepanel_settings_vault_viewer_reset_success',
          'Password vault was reset. You can create a new vault password now.',
        ),
      });
    } catch (error) {
      setVaultFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsVaultBusy(false);
    }
  };

  const handleOpenCreateSecret = () => {
    if (!vaultStatus.unlocked || isVaultBusy || secretEditor) {
      return;
    }
    setVaultFeedback(null);
    setEditingSecretName(null);
    setSecretEditor({
      mode: 'create',
      name: '',
      value: '',
    });
  };

  const handleOpenEditSecret = async (name: string) => {
    if (!vaultStatus.unlocked || isVaultBusy || editingSecretName || secretEditor) {
      return;
    }
    setVaultFeedback(null);
    setEditingSecretName(name);
    try {
      const value = await resolveSecretValue(name);
      setSecretEditor({
        mode: 'edit',
        originalName: name,
        name,
        value,
      });
    } catch (error) {
      setVaultFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setEditingSecretName(null);
    }
  };

  const handleCloseSecretEditor = () => {
    if (isVaultBusy) {
      return;
    }
    setSecretEditor(null);
    setEditingSecretName(null);
  };

  const handleSaveSecret = async () => {
    if (!secretEditor || isVaultBusy || !vaultStatus.unlocked) {
      return;
    }
    const nextName = secretEditor.name.trim();
    if (!nextName) {
      setVaultFeedback({
        type: 'error',
        message: t('sidepanel_settings_vault_secret_name_required', 'Password name is required.'),
      });
      return;
    }
    if (!secretEditor.value) {
      setVaultFeedback({
        type: 'error',
        message: t('sidepanel_settings_vault_secret_value_required', 'Password value is required.'),
      });
      return;
    }
    setIsVaultBusy(true);
    setVaultFeedback(null);
    try {
      const shouldRevealCurrentValue =
        secretEditor.mode === 'edit' &&
        Boolean(
          secretEditor.originalName &&
            Object.prototype.hasOwnProperty.call(revealedVaultValues, secretEditor.originalName),
        );
      if (secretEditor.mode === 'edit' && secretEditor.originalName && secretEditor.originalName !== nextName) {
        await deleteSecretValue(secretEditor.originalName);
      }
      const status = await upsertSecretValue(nextName, secretEditor.value);
      setVaultStatus({
        configured: status.configured,
        unlocked: status.unlocked,
        secretCount: status.secretCount,
        names: status.names,
      });
      setRevealedVaultValues((current) => {
        const next = { ...current };
        if (secretEditor.mode === 'edit' && secretEditor.originalName) {
          delete next[secretEditor.originalName];
        }
        if (Object.prototype.hasOwnProperty.call(next, nextName) || shouldRevealCurrentValue) {
          next[nextName] = secretEditor.value;
        }
        return next;
      });
      setSecretEditor(null);
      setEditingSecretName(null);
      setVaultFeedback({
        type: 'success',
        message:
          secretEditor.mode === 'edit'
            ? t('sidepanel_settings_vault_secret_saved', 'Password updated.')
            : t('sidepanel_settings_vault_secret_created', 'Password saved.'),
      });
    } catch (error) {
      setVaultFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsVaultBusy(false);
    }
  };

  const handleDeleteSecret = async (name: string) => {
    if (!vaultStatus.unlocked || isVaultBusy) {
      return;
    }
    setIsVaultBusy(true);
    setVaultFeedback(null);
    try {
      const status = await deleteSecretValue(name);
      setVaultStatus({
        configured: status.configured,
        unlocked: status.unlocked,
        secretCount: status.secretCount,
        names: status.names,
      });
      setRevealedVaultValues((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
      if (secretEditor?.originalName === name || secretEditor?.name === name) {
        setSecretEditor(null);
      }
      setEditingSecretName(null);
      setVaultFeedback({
        type: 'success',
        message: t('sidepanel_settings_vault_secret_deleted', 'Password deleted.'),
      });
    } catch (error) {
      setVaultFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsVaultBusy(false);
    }
  };

  const renderSecretEditorCard = () => {
    if (!secretEditor) {
      return null;
    }

    return (
      <div className="grid gap-2 rounded-md border border-border/70 bg-muted/10 p-3">
        <p className="text-xs font-semibold text-card-foreground">
          {secretEditor.mode === 'edit'
            ? t('sidepanel_settings_vault_secret_editor_edit', 'Edit password')
            : t('sidepanel_settings_vault_secret_editor_create', 'Add password')}
        </p>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium text-card-foreground">
            {t('sidepanel_settings_vault_secret_name_label', 'Password name')}
          </span>
          <input
            className="input h-9 min-w-0"
            type="text"
            autoComplete="off"
            value={secretEditor.name}
            placeholder={t(
              'sidepanel_settings_vault_secret_name_placeholder',
              'example: login_password',
            )}
            onChange={(event) =>
              setSecretEditor((current) =>
                current
                  ? {
                      ...current,
                      name: event.target.value,
                    }
                  : current,
              )
            }
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium text-card-foreground">
            {t('sidepanel_settings_vault_secret_value_label', 'Password')}
          </span>
          <input
            className="input h-9 min-w-0"
            type="password"
            autoComplete="new-password"
            value={secretEditor.value}
            placeholder={t(
              'sidepanel_settings_vault_secret_value_placeholder',
              'Enter the password value',
            )}
            onChange={(event) =>
              setSecretEditor((current) =>
                current
                  ? {
                      ...current,
                      value: event.target.value,
                    }
                  : current,
              )
            }
          />
        </label>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn-ghost h-8 gap-1 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleCloseSecretEditor}
            disabled={isVaultBusy}
          >
            <X className="h-3.5 w-3.5" />
            {t('sidepanel_settings_vault_secret_cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="btn-primary h-8 gap-1 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void handleSaveSecret();
            }}
            disabled={isVaultBusy}
          >
            <Check className="h-3.5 w-3.5" />
            {t('sidepanel_settings_vault_secret_save', 'Save')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">
                {t('sidepanel_settings_vault_viewer_title', 'Password Vault Viewer')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  'sidepanel_settings_vault_viewer_subtitle',
                  'Open the password vault viewer and enter the vault password to view and manage saved passwords.',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary gap-2 w-full"
            onClick={() => {
              void handleOpenVaultViewer();
            }}
          >
            <KeyRound className="h-4 w-4" />
            {t('sidepanel_settings_vault_viewer_open', 'Open password vault')}
          </button>
        </div>
      </Card>
      {isVaultViewerOpen ? (
        <div
          className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/40 p-3"
          onClick={handleCloseVaultViewer}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">
                  {t('sidepanel_settings_vault_viewer_title', 'Password Vault Viewer')}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(
                    'sidepanel_settings_vault_viewer_modal_subtitle',
                    'Enter the vault password to view and manage saved passwords.',
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon h-8 w-8 shrink-0 rounded-full"
                aria-label={t('sidepanel_action_close', 'Close')}
                onClick={handleCloseVaultViewer}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="mb-3 rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold text-foreground">
                      {t('sidepanel_settings_vault_viewer_status', 'Status')}:
                    </span>
                    <span className="text-muted-foreground">
                      {vaultStatus.configured
                        ? vaultStatus.unlocked
                          ? t('sidepanel_settings_vault_viewer_status_unlocked', 'Configured / Unlocked')
                          : t('sidepanel_settings_vault_viewer_status_locked', 'Configured / Locked')
                        : t('sidepanel_settings_vault_viewer_status_not_configured', 'Not configured')}
                    </span>
                    <span className="text-muted-foreground">
                      {t('sidepanel_settings_vault_viewer_count', '{count} password(s)').replace(
                        '{count}',
                        String(vaultStatus.secretCount),
                      )}
                    </span>
                  </div>
                  {vaultStatus.unlocked ? (
                    <button
                      type="button"
                      className="btn-ghost h-8 shrink-0 gap-2 px-3 text-xs whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleOpenCreateSecret}
                      disabled={isVaultBusy || Boolean(editingSecretName || secretEditor)}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {t('sidepanel_settings_vault_secret_add', 'Add password')}
                    </button>
                  ) : null}
                </div>
              </div>

              {!vaultStatus.unlocked ? (
                <div className="grid gap-2">
                  <input
                    className="input h-9 min-w-0"
                    type="password"
                    autoComplete="new-password"
                    value={vaultPasswordInput}
                    placeholder={t(
                      'sidepanel_settings_vault_viewer_password_input',
                      'Vault password (create/unlock)',
                    )}
                    onChange={(event) => setVaultPasswordInput(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary gap-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      void handleUnlockOrCreateVault();
                    }}
                    disabled={isVaultBusy || !vaultPasswordInput.trim()}
                  >
                    <Unlock className="h-4 w-4" />
                    {vaultStatus.configured
                      ? t('sidepanel_settings_vault_viewer_unlock', 'Unlock vault')
                      : t('sidepanel_settings_vault_viewer_create_unlock', 'Create vault')}
                  </button>
                  {vaultStatus.configured ? (
                    <button
                      type="button"
                      className="btn-ghost h-9 w-full justify-center gap-1 text-xs text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        void handleResetVault();
                      }}
                      disabled={isVaultBusy}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t(
                        'sidepanel_settings_vault_viewer_reset_action',
                        'Forgot vault password? Reset vault',
                      )}
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className={vaultStatus.unlocked ? 'mt-3 min-h-0 flex-1 overflow-y-auto pr-1' : 'mt-3'}>
                {vaultStatus.unlocked ? (
                  vaultStatus.names.length > 0 ? (
                    <div className="grid gap-2">
                    {vaultStatus.names.map((name) => {
                      const isRevealed = Object.prototype.hasOwnProperty.call(revealedVaultValues, name);
                      const isLoadingReveal = revealingSecretName === name;
                      return (
                        <div key={name} className="grid gap-2 rounded-md border border-border/70 bg-card/50 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-card-foreground">{name}</span>
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              <button
                                type="button"
                                className="btn-icon h-7 w-7 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => {
                                  void handleToggleRevealSecret(name);
                                }}
                                disabled={Boolean(revealingSecretName && !isLoadingReveal)}
                                aria-label={
                                  isRevealed
                                    ? t('sidepanel_settings_vault_viewer_hide', 'Hide')
                                    : t('sidepanel_settings_vault_viewer_show', 'Show')
                                }
                                title={
                                  isLoadingReveal
                                    ? t('sidepanel_settings_vault_viewer_loading', 'Loading...')
                                    : isRevealed
                                      ? t('sidepanel_settings_vault_viewer_hide', 'Hide')
                                      : t('sidepanel_settings_vault_viewer_show', 'Show')
                                }
                              >
                                {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                className="btn-icon h-7 w-7 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => {
                                  void handleOpenEditSecret(name);
                                }}
                                disabled={isVaultBusy || Boolean(editingSecretName || secretEditor)}
                                aria-label={t('sidepanel_settings_vault_secret_edit', 'Edit')}
                                title={
                                  editingSecretName === name
                                    ? t('sidepanel_settings_vault_viewer_loading', 'Loading...')
                                    : t('sidepanel_settings_vault_secret_edit', 'Edit')
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="btn-icon btn-icon-danger h-7 w-7 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => {
                                  setPendingDeleteSecretName(name);
                                }}
                                disabled={isVaultBusy || Boolean(editingSecretName)}
                                aria-label={t('sidepanel_settings_vault_secret_delete', 'Delete')}
                                title={t('sidepanel_settings_vault_secret_delete', 'Delete')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="rounded border border-border bg-muted/30 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                            {isRevealed ? revealedVaultValues[name] : '********'}
                          </div>
                          {secretEditor?.mode === 'edit' && secretEditor.originalName === name ? renderSecretEditorCard() : null}
                        </div>
                      );
                    })}
                    {secretEditor?.mode === 'create' ? renderSecretEditorCard() : null}
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <p className="text-xs text-muted-foreground">
                        {t('sidepanel_settings_vault_viewer_empty', 'No passwords saved in the vault.')}
                      </p>
                      {secretEditor?.mode === 'create' ? renderSecretEditorCard() : null}
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'sidepanel_settings_vault_viewer_unlock_hint',
                      'Unlock the vault to view and manage saved passwords.',
                    )}
                  </p>
                )}
              </div>

              {vaultFeedback ? (
                <p className={'mt-3 text-xs ' + (vaultFeedback.type === 'error' ? 'text-red-600' : 'text-emerald-600')}>
                  {vaultFeedback.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingDeleteSecretName)}
        title={t('sidepanel_settings_vault_secret_delete', 'Delete')}
        message={t('sidepanel_settings_vault_secret_delete_confirm', 'Delete password "{name}"? This action cannot be undone.')
          .replace('{name}', pendingDeleteSecretName)}
        confirmLabel={t('sidepanel_action_delete', 'Delete')}
        cancelLabel={t('sidepanel_action_cancel', 'Cancel')}
        danger
        zIndexBase={2147483200}
        onCancel={() => setPendingDeleteSecretName('')}
        onConfirm={() => {
          const targetSecretName = pendingDeleteSecretName;
          setPendingDeleteSecretName('');
          if (!targetSecretName) {
            return;
          }
          void handleDeleteSecret(targetSecretName);
        }}
      />
    </>
  );
}
