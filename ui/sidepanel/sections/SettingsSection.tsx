import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Copy, Download, ExternalLink, Eye, EyeOff, KeyRound, Languages, Share2, Unlock, Upload, X } from 'lucide-react';
import Card from '../components/Card';
import { LOCALE_OPTIONS, SupportedLocale, getLocaleLabel, setLocale, t, useLocale } from '../utils/i18n';
import { getAllSitesData, setAllSitesData } from '../../../shared/storage';
import { buildExportPayload, mergeSitesData, parseImportPayload } from '../../../shared/importExport';
import {
  exportSecretVaultTransferPayload,
  getSecretsVaultStatus,
  importSecretVaultTransferPayload,
  parseSecretVaultTransferPayload,
  resetSecretsVault,
  resolveSecretValue,
  unlockSecretsVault,
} from '../../../shared/secrets';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export default function SettingsSection() {
  const locale = useLocale();
  const localeLabel = getLocaleLabel(locale);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [vaultStatus, setVaultStatus] = useState<{
    configured: boolean;
    unlocked: boolean;
    secretCount: number;
    names: string[];
  }>({
    configured: false,
    unlocked: false,
    secretCount: 0,
    names: [],
  });
  const [vaultPasswordInput, setVaultPasswordInput] = useState('');
  const [isVaultBusy, setIsVaultBusy] = useState(false);
  const [vaultFeedback, setVaultFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [revealedVaultValues, setRevealedVaultValues] = useState<Record<string, string>>({});
  const [revealingSecretName, setRevealingSecretName] = useState<string | null>(null);
  const [isVaultViewerOpen, setIsVaultViewerOpen] = useState(false);
  const storeUrl = chrome?.runtime?.id
    ? `https://chromewebstore.google.com/detail/${chrome.runtime.id}`
    : 'https://chromewebstore.google.com/';

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
    }
  };

  useEffect(() => {
    void refreshVaultStatus().catch(() => {
      // Non-blocking: settings page should still load even if vault status can't be read.
    });
  }, []);

  const downloadExportJson = async (payload: unknown) => {
    const content = JSON.stringify(payload, null, 2);
    const filename = `page-augmentor-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExport = async () => {
    if (isExporting) {
      return;
    }
    setIsExporting(true);
    setFeedback(null);
    try {
      const sites = await getAllSitesData();
      let secretVaultTransfer: ReturnType<typeof parseSecretVaultTransferPayload> = null;
      const vaultStatus = await getSecretsVaultStatus();
      if (vaultStatus.configured && vaultStatus.secretCount > 0) {
        const includeVaultPasswords = window.confirm(
          t(
            'sidepanel_settings_export_include_vault_passwords_confirm',
            'Password vault data was found. Include saved passwords in this export?',
          ),
        );
        if (includeVaultPasswords) {
          const vaultPassword = window.prompt(
            t(
              'sidepanel_settings_export_vault_password_prompt',
              'Enter your vault password to include saved passwords in the export.',
            ),
            '',
          );
          if (vaultPassword === null) {
            setIsExporting(false);
            return;
          }
          if (!vaultPassword) {
            throw new Error(
              t(
                'sidepanel_settings_export_vault_password_required',
                'Vault password is required to export saved passwords.',
              ),
            );
          }
          secretVaultTransfer = await exportSecretVaultTransferPayload(vaultPassword);
        }
      }
      const payload = buildExportPayload(sites, {
        redactLiteralInputs: true,
      });
      const finalPayload =
        secretVaultTransfer && Object.keys(secretVaultTransfer.items).length > 0
          ? { ...payload, secrets: secretVaultTransfer }
          : payload;
      await downloadExportJson(finalPayload);
      setFeedback({
        type: 'success',
        message: t('sidepanel_settings_feedback_export_success', 'Exported {count} site(s).').replace(
          '{count}',
          String(Object.keys(sites).length),
        ),
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: t('sidepanel_settings_feedback_export_failed', 'Export failed: {error}').replace(
          '{error}',
          error instanceof Error ? error.message : String(error),
        ),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const triggerImport = () => {
    if (isImporting) {
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setIsImporting(true);
    setFeedback(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const secretsBundle = isRecord(raw) ? parseSecretVaultTransferPayload(raw.secrets) : null;
      const parsed = parseImportPayload(raw);
      const currentSites = await getAllSitesData();
      const mergedSites = mergeSitesData(currentSites, parsed.sites);
      await setAllSitesData(mergedSites);
      let secretImportCount = 0;
      let secretImportSkippedReason = '';
      if (secretsBundle && Object.keys(secretsBundle.items).length > 0) {
        const currentVault = await getSecretsVaultStatus();
        let vaultPassword: string | null = null;
        if (!currentVault.configured) {
          const shouldCreateVault = window.confirm(
            t(
              'sidepanel_settings_import_vault_create_confirm',
              'This file contains password vault data. Create a password vault now and import saved passwords?',
            ),
          );
          if (shouldCreateVault) {
            vaultPassword = window.prompt(
              t(
                'sidepanel_settings_import_vault_password_prompt_create',
                'Create a vault password (used to lock/unlock the imported password vault).',
              ),
              '',
            );
            if (!vaultPassword) {
              secretImportSkippedReason = t(
                'sidepanel_settings_import_vault_skipped_no_password',
                'Skipped password vault import (vault password was not provided).',
              );
            }
          } else {
            secretImportSkippedReason = t(
              'sidepanel_settings_import_vault_skipped_user_declined',
              'Skipped password vault import.',
            );
          }
        } else {
          vaultPassword = window.prompt(
            t(
              'sidepanel_settings_import_vault_password_prompt_unlock',
              'This file contains password vault data. Enter your vault password to import saved passwords.',
            ),
            '',
          );
          if (!vaultPassword) {
            secretImportSkippedReason = t(
              'sidepanel_settings_import_vault_skipped_no_password',
              'Skipped password vault import (vault password was not provided).',
            );
          }
        }

        if (vaultPassword) {
          await importSecretVaultTransferPayload(secretsBundle, vaultPassword);
          secretImportCount = Object.keys(secretsBundle.items).length;
          await refreshVaultStatus().catch(() => {
            // Ignore UI refresh failure; import already completed.
          });
        }
      }
      const warningSuffix =
        parsed.summary.warnings.length > 0
          ? t('sidepanel_settings_feedback_import_warning_suffix', ' ({count} warning(s))').replace(
              '{count}',
              String(parsed.summary.warnings.length),
            )
          : '';
      const secretSuffix =
        secretImportCount > 0
          ? ` + ${secretImportCount} ${t('sidepanel_settings_data_import_passwords_suffix', 'password(s) imported')}`
          : secretImportSkippedReason
            ? ` ${secretImportSkippedReason}`
            : '';
      setFeedback({
        type: 'success',
        message:
          t(
            'sidepanel_settings_feedback_import_success',
            'Imported {sites} site(s), {elements} element(s), {flows} flow(s).',
          )
            .replace('{sites}', String(parsed.summary.siteCount))
            .replace('{elements}', String(parsed.summary.elementCount))
            .replace('{flows}', String(parsed.summary.flowCount)) +
          warningSuffix +
          secretSuffix,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: t('sidepanel_settings_feedback_import_failed', 'Import failed: {error}').replace(
          '{error}',
          error instanceof Error ? error.message : String(error),
        ),
      });
    } finally {
      event.target.value = '';
      setIsImporting(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  };

  const handleCopyStoreLink = async () => {
    try {
      await copyToClipboard(storeUrl);
      setFeedback({
        type: 'success',
        message: t('sidepanel_settings_feedback_copy_success', 'Store link copied.'),
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: t('sidepanel_settings_feedback_copy_failed', 'Copy failed: {error}').replace(
          '{error}',
          error instanceof Error ? error.message : String(error),
        ),
      });
    }
  };

  const handleOpenStore = () => {
    const nextWindow = window.open(storeUrl, '_blank', 'noopener,noreferrer');
    if (!nextWindow) {
      setFeedback({
        type: 'error',
        message: t('sidepanel_settings_feedback_open_failed', 'Unable to open store link.'),
      });
      return;
    }
    setFeedback({
      type: 'success',
      message: t('sidepanel_settings_feedback_open_success', 'Opened store link in a new tab.'),
    });
  };

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


  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-card-foreground">
          {t('sidepanel_settings_title', 'Settings')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('sidepanel_settings_subtitle', 'Fine-tune data, language, and sharing.')}
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">
                {t('sidepanel_settings_data_title', 'Data management')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('sidepanel_settings_data_subtitle', 'Import or export saved elements and flows.')}
              </p>
            </div>
          </div>
          <div className="flex flex-nowrap gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                void handleImportChange(event);
              }}
            />
            <button
              type="button"
              className="btn-ghost gap-2 flex-1 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={triggerImport}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4" />
              {isImporting
                ? `${t('sidepanel_settings_data_import', 'Import')}...`
                : t('sidepanel_settings_data_import', 'Import')}
            </button>
            <button
              type="button"
              className="btn-primary gap-2 flex-1 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                void handleExport();
              }}
              disabled={isExporting}
            >
              <Download className="h-4 w-4" />
              {isExporting
                ? `${t('sidepanel_settings_data_export', 'Export')}...`
                : t('sidepanel_settings_data_export', 'Export')}
            </button>
          </div>
          {feedback ? (
            <p className={`text-xs ${feedback.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
              {feedback.message}
            </p>
          ) : null}
        </div>
      </Card>

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
                  'Open the password vault viewer and enter the vault password to browse saved passwords.',
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

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground">
              <Languages className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">
                {t('sidepanel_settings_language_title', 'Language')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('sidepanel_settings_language_subtitle', 'Pick the language for the side panel.')}
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <select
              className="input select"
              value={locale}
              onChange={(event) => {
                void setLocale(event.target.value as SupportedLocale);
              }}
            >
              {LOCALE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey, option.fallback)}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {t('sidepanel_settings_locale', 'Locale: {locale}').replace('{locale}', localeLabel)}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">
                {t('sidepanel_settings_share_title', 'Share')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('sidepanel_settings_share_subtitle', 'Send the Chrome Web Store link to teammates.')}
              </p>
            </div>
          </div>
          <div className="flex flex-nowrap gap-2">
            <button type="button" className="btn-primary gap-2" onClick={() => void handleCopyStoreLink()}>
              <Copy className="h-4 w-4" />
              {t('sidepanel_settings_share_copy', 'Copy link')}
            </button>
            <button type="button" className="btn-ghost gap-2" onClick={handleOpenStore}>
              <ExternalLink className="h-4 w-4" />
              {t('sidepanel_settings_share_open', 'Open store')}
            </button>
          </div>
        </div>
      </Card>
      {isVaultViewerOpen ? (
        <div
          className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/40 p-3"
          onClick={() => setIsVaultViewerOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-auto rounded-xl border border-border bg-card p-3 shadow-2xl"
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
                    'Enter the vault password to view saved passwords.',
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn-icon h-8 w-8"
                aria-label={t('sidepanel_action_close', 'Close')}
                onClick={() => setIsVaultViewerOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
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
            </div>

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
              {vaultStatus.configured && !vaultStatus.unlocked ? (
                <button
                  type="button"
                  className="btn-ghost h-9 w-full justify-center text-xs text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void handleResetVault();
                  }}
                  disabled={isVaultBusy}
                >
                  {t(
                    'sidepanel_settings_vault_viewer_reset_action',
                    'Forgot vault password? Reset vault',
                  )}
                </button>
              ) : null}
            </div>

            <div className="mt-3">
              {vaultStatus.unlocked ? (
                vaultStatus.names.length > 0 ? (
                  <div className="grid gap-2">
                    {vaultStatus.names.map((name) => {
                      const isRevealed = Object.prototype.hasOwnProperty.call(revealedVaultValues, name);
                      const isLoadingReveal = revealingSecretName === name;
                      return (
                        <div
                          key={name}
                          className="grid gap-2 rounded-md border border-border/70 bg-card/50 p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-card-foreground">{name}</span>
                            <button
                              type="button"
                              className="btn-ghost h-7 gap-1 px-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => {
                                void handleToggleRevealSecret(name);
                              }}
                              disabled={Boolean(revealingSecretName && !isLoadingReveal)}
                            >
                              {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              {isLoadingReveal
                                ? t('sidepanel_settings_vault_viewer_loading', 'Loading...')
                                : isRevealed
                                  ? t('sidepanel_settings_vault_viewer_hide', 'Hide')
                                  : t('sidepanel_settings_vault_viewer_show', 'Show')}
                            </button>
                          </div>
                          <div className="rounded border border-border bg-muted/30 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                            {isRevealed ? revealedVaultValues[name] : '********'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('sidepanel_settings_vault_viewer_empty', 'No passwords saved in the vault.')}
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t(
                    'sidepanel_settings_vault_viewer_unlock_hint',
                    'Unlock the vault to browse saved passwords.',
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
      ) : null}

    </section>
  );
}
