import { useEffect, useMemo, useState } from 'react';
import SelectMenu from '../SelectMenu';
import { t } from '../../utils/i18n';
import {
  buildSecretToken,
  getSecretsVaultStatus,
  isSecretTokenValue,
  parseSecretTokenValue,
  unlockSecretsVault,
  upsertSecretValue,
} from '../../../../shared/secrets';
import type { StepData, StepField } from './types';
import { getStepFieldStringValue, isPasswordLikeSelector } from './secretInputUtils';

type VaultStatusSnapshot = {
  configured: boolean;
  unlocked: boolean;
  secretCount: number;
  names: string[];
};

type InputSecretValueControlProps = {
  step: StepData;
  field: StepField;
  onUpdateField: (stepId: string, fieldId: string, value: string) => void;
  onModeChange?: (mode: 'literal' | 'secret') => void;
  setFieldInputRef: (
    stepId: string,
    fieldId: string,
  ) => (element: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onFocusField: (stepId: string, fieldId: string) => void;
};

const defaultVaultStatus: VaultStatusSnapshot = {
  configured: false,
  unlocked: false,
  secretCount: 0,
  names: [],
};

const normalizeSecretNameSuggestion = (input: string) => {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'login_password';
};

export default function InputSecretValueControl({
  step,
  field,
  onUpdateField,
  onModeChange,
  setFieldInputRef,
  onFocusField,
}: InputSecretValueControlProps) {
  const selectorValue = getStepFieldStringValue(step, 'selector');
  const passwordLike = isPasswordLikeSelector(selectorValue);
  const tokenInfo = parseSecretTokenValue(field.value);
  const [mode, setMode] = useState<'literal' | 'secret'>(() => (tokenInfo ? 'secret' : 'literal'));
  const [vaultStatus, setVaultStatus] = useState<VaultStatusSnapshot>(defaultVaultStatus);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showCreateSecretForm, setShowCreateSecretForm] = useState(false);
  const [newSecretName, setNewSecretName] = useState('');
  const [newSecretValue, setNewSecretValue] = useState('');
  const [selectedSecretName, setSelectedSecretName] = useState('');

  // While a secret is already bound, users still need to be able to pick a different
  // vault entry from the dropdown and re-bind without removing first.
  const effectiveSelectedSecretName = selectedSecretName || tokenInfo?.name || '';

  useEffect(() => {
    setMode(tokenInfo ? 'secret' : 'literal');
    if (tokenInfo?.name) {
      setSelectedSecretName(tokenInfo.name);
    }
  }, [step.id, field.id, tokenInfo?.name]);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    if (!passwordLike && !tokenInfo) {
      return;
    }
    let active = true;
    void getSecretsVaultStatus()
      .then((status) => {
        if (!active) {
          return;
        }
        setVaultStatus({
          configured: status.configured,
          unlocked: status.unlocked,
          secretCount: status.secretCount,
          names: status.names,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
    };
  }, [passwordLike, tokenInfo?.name]);

  const refreshVaultStatus = async () => {
    const status = await getSecretsVaultStatus();
    setVaultStatus({
      configured: status.configured,
      unlocked: status.unlocked,
      secretCount: status.secretCount,
      names: status.names,
    });
    if (status.names.length > 0 && !selectedSecretName) {
      setSelectedSecretName(status.names[0]);
    }
  };

  const secretOptions = useMemo(
    () => vaultStatus.names.map((name) => ({ value: name, label: name })),
    [vaultStatus.names],
  );
  const secretTokenMissing = tokenInfo
    ? !vaultStatus.configured || (vaultStatus.unlocked && !vaultStatus.names.includes(tokenInfo.name))
    : false;
  const validSelectedSecretName = vaultStatus.names.includes(effectiveSelectedSecretName)
    ? effectiveSelectedSecretName
    : '';

  const handleUnlockVault = async () => {
    if (!unlockPassword.trim() || isBusy) {
      return;
    }
    setIsBusy(true);
    setErrorMessage('');
    try {
      await unlockSecretsVault(unlockPassword);
      setUnlockPassword('');
      await refreshVaultStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  };

  const openCreateSecretForm = (prefillValue?: string) => {
    setMode('secret');
    setShowCreateSecretForm(true);
    setNewSecretName(
      newSecretName || normalizeSecretNameSuggestion(selectorValue || field.placeholder || 'login_password'),
    );
    if (typeof prefillValue === 'string') {
      setNewSecretValue(prefillValue);
    }
    setErrorMessage('');
  };

  const handleCreateAndBindSecret = async () => {
    if (isBusy) {
      return;
    }
    const normalizedName = newSecretName.trim();
    if (!normalizedName) {
      setErrorMessage(t('sidepanel_flow_input_secret_name_required', 'Secret name is required.'));
      return;
    }
    if (vaultStatus.names.includes(normalizedName)) {
      setErrorMessage(
        t(
          'sidepanel_flow_input_secret_name_duplicate',
          'A password with this name already exists. Please choose a different name.',
        ),
      );
      return;
    }
    setIsBusy(true);
    setErrorMessage('');
    try {
      await upsertSecretValue(normalizedName, newSecretValue);
      onUpdateField(step.id, field.id, buildSecretToken(normalizedName));
      onFocusField(step.id, field.id);
      setSelectedSecretName(normalizedName);
      setShowCreateSecretForm(false);
      setNewSecretValue('');
      await refreshVaultStatus();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  };

  const handleBindSelectedSecret = () => {
    const name = validSelectedSecretName.trim();
    if (!name) {
      setErrorMessage(t('sidepanel_flow_input_secret_select_required', 'Please choose a password.'));
      return;
    }
    setErrorMessage('');
    onUpdateField(step.id, field.id, buildSecretToken(name));
    onFocusField(step.id, field.id);
  };

  const handleRemoveBinding = () => {
    setErrorMessage('');
    onUpdateField(step.id, field.id, '');
    setMode('literal');
    onFocusField(step.id, field.id);
  };

  const literalBlocked = passwordLike && field.value.trim() && !isSecretTokenValue(field.value);

  return (
    <div className="grid w-full gap-2 rounded-md border border-border/70 bg-muted/20 p-2">
      <div className="grid gap-1">
        <span className="text-[11px] font-semibold text-muted-foreground">
          {t('sidepanel_flow_input_value_mode', 'Input method')}
        </span>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            className={`h-7 w-full rounded border px-2 text-[11px] ${
              mode === 'literal' ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground'
            }`}
            onClick={() => {
              setMode('literal');
              setErrorMessage('');
            }}
          >
            {t('sidepanel_flow_input_value_mode_literal', 'Type directly')}
          </button>
          <button
            type="button"
            className={`h-7 w-full rounded border px-2 text-[11px] ${
              mode === 'secret'
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : passwordLike
                  ? 'border-amber-400/50 bg-amber-100/40 text-amber-900'
                  : 'border-border bg-card text-muted-foreground'
            }`}
            onClick={() => {
              setMode('secret');
              void refreshVaultStatus().catch((error) => {
                setErrorMessage(error instanceof Error ? error.message : String(error));
              });
            }}
          >
            {t('sidepanel_flow_input_value_mode_secret', 'Choose from password vault')}
          </button>
        </div>
      </div>

      {mode === 'literal' ? (
        <div className="grid gap-2">
          <input
            ref={setFieldInputRef(step.id, field.id)}
            data-flow-step-id={step.id}
            data-flow-field-id={field.id}
            className="input min-w-0"
            type={field.type === 'number' ? 'number' : 'text'}
            value={field.value}
            onChange={(event) => onUpdateField(step.id, field.id, event.target.value)}
            placeholder={field.placeholder}
            onFocus={() => onFocusField(step.id, field.id)}
          />
          {literalBlocked ? (
            <div className="grid gap-2 rounded border border-amber-400/50 bg-amber-100/30 p-2 text-[11px] text-amber-900">
              <p>
                {t(
                  'sidepanel_flow_input_password_warning',
                  'This looks like a password field. Passwords cannot be saved in plain text inside a flow.',
                )}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn-primary h-8 w-full justify-center px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void refreshVaultStatus().catch((error) => {
                      setErrorMessage(error instanceof Error ? error.message : String(error));
                    });
                    openCreateSecretForm(field.value);
                  }}
                  disabled={isBusy}
                >
                  {t('sidepanel_flow_input_password_save_to_vault', 'Save to password vault and bind')}
                </button>
                <button
                  type="button"
                  className="btn-ghost h-8 w-full justify-center px-2 text-[11px]"
                  onClick={() => {
                    setMode('secret');
                    void refreshVaultStatus().catch((error) => {
                      setErrorMessage(error instanceof Error ? error.message : String(error));
                    });
                  }}
                >
                  {t('sidepanel_flow_input_password_use_vault', 'Use password vault')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2 rounded border border-border/70 bg-card/50 p-2">
          {tokenInfo?.name ? (
            <div
              className={`text-[11px] ${
                secretTokenMissing ? 'rounded border border-amber-400/50 bg-amber-100/30 px-2 py-1 text-amber-900' : 'text-foreground'
              }`}
            >
              {secretTokenMissing
                ? t(
                    'sidepanel_flow_input_secret_bound_missing',
                    'Bound password no longer exists in the vault: {name}. Please choose or create a password and bind again.',
                  ).replace('{name}', tokenInfo.name)
                : t('sidepanel_flow_input_secret_bound', 'Bound: {name}').replace('{name}', tokenInfo.name)}
            </div>
          ) : null}

          {!vaultStatus.unlocked ? (
            <div className="grid gap-2">
              <p className="text-[11px] text-muted-foreground">
                {vaultStatus.configured
                  ? t('sidepanel_flow_input_secret_unlock_help', 'Unlock the password vault to select or save a password.')
                  : t('sidepanel_flow_input_secret_create_help', 'Create a password vault to save and reuse passwords.')}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  className="input h-8 min-w-0 flex-1"
                  type="password"
                  autoComplete="new-password"
                  value={unlockPassword}
                  placeholder={t('sidepanel_flow_input_secret_master_password', 'Master password')}
                  onChange={(event) => setUnlockPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary h-8 w-full justify-center px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleUnlockVault()}
                  disabled={isBusy || !unlockPassword.trim()}
                >
                  {vaultStatus.configured
                    ? t('sidepanel_flow_input_secret_unlock', 'Unlock password vault')
                    : t('sidepanel_flow_input_secret_create_and_unlock', 'Create and unlock password vault')}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <div className="grid gap-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {t('sidepanel_flow_input_secret_select', 'Password in vault')}
                </span>
                <SelectMenu
                  value={validSelectedSecretName}
                  options={secretOptions}
                  disabled={!vaultStatus.names.length}
                  placeholder={t('sidepanel_flow_input_secret_select_placeholder', 'Select password')}
                  onChange={(value) => {
                    setSelectedSecretName(value);
                    setErrorMessage('');
                  }}
                  useInputStyle={false}
                  buttonClassName="btn-ghost h-8 w-full min-w-0 justify-between px-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn-primary h-8 w-full justify-center px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleBindSelectedSecret}
                  disabled={!validSelectedSecretName}
                >
                  {t('sidepanel_flow_input_secret_bind_selected', 'Bind selected password')}
                </button>
                <button
                  type="button"
                  className="btn-ghost h-8 w-full justify-center px-2 text-[11px]"
                  onClick={() => openCreateSecretForm(passwordLike && !tokenInfo ? field.value : '')}
                >
                  {t('sidepanel_flow_input_secret_create', 'Create new password')}
                </button>
              </div>
            </div>
          )}

          {showCreateSecretForm ? (
            <div className="grid gap-2 rounded border border-border bg-muted/20 p-2">
              <p className="text-[11px] font-semibold text-foreground">
                {t('sidepanel_flow_input_secret_create', 'Create new password')}
              </p>
              <input
                className="input h-8 min-w-0"
                type="text"
                value={newSecretName}
                placeholder={t('sidepanel_flow_input_secret_name_placeholder', 'Secret name (e.g. login_password)')}
                onChange={(event) => setNewSecretName(event.target.value)}
              />
              <input
                className="input h-8 min-w-0"
                type="password"
                autoComplete="new-password"
                value={newSecretValue}
                placeholder={t('sidepanel_flow_input_secret_value_placeholder', 'Password value')}
                onChange={(event) => setNewSecretValue(event.target.value)}
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn-primary h-8 w-full justify-center px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleCreateAndBindSecret()}
                  disabled={isBusy || !vaultStatus.unlocked || !newSecretName.trim()}
                >
                  {t('sidepanel_flow_input_secret_save_bind', 'Save and bind')}
                </button>
                <button
                  type="button"
                  className="btn-ghost h-8 w-full justify-center px-2 text-[11px]"
                  onClick={() => setShowCreateSecretForm(false)}
                >
                  {t('sidepanel_action_cancel', 'Cancel')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {passwordLike ? (
        <p className="text-[10px] text-muted-foreground">
          {t(
            'sidepanel_flow_input_password_migration_required',
            'Password fields must use the password vault. Plain text passwords are blocked on save and run.',
          )}
        </p>
      ) : null}
      {errorMessage ? <p className="text-[11px] text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
