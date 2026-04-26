import { useRef, useState, type ChangeEvent } from 'react';
import { Copy, Download, ExternalLink, Languages, Share2, Upload } from 'lucide-react';
import Card from '../components/Card';
import PasswordPromptDialog from '../components/PasswordPromptDialog';
import PasswordVaultManager from '../components/PasswordVaultManager';
import { LOCALE_OPTIONS, SupportedLocale, getLocaleLabel, setLocale, t, useLocale } from '../utils/i18n';
import { getGlobalSettings, setGlobalSettings } from '../../../shared/globalSettings';
// 1.14 — reads go through `shared/storage` (read-only, any realm);
// writes go through `shared/siteStorageClient` (messages the SW).
import { getAllSitesData } from '../../../shared/storage';
import { setAllSitesData } from '../../../shared/siteStorageClient';
import { buildExportPayload, mergeSitesData, parseImportPayload } from '../../../shared/importExport';
// 1.1 — key-requiring vault ops go through the message-based client (AES
// key lives SW-only). Pure helpers like `parseSecretVaultTransferPayload`
// stay in the shared module.
import {
  exportSecretVaultTransferPayload,
  getSecretsVaultStatus,
  importSecretVaultTransferPayload,
} from '../../../shared/secretsClient';
import { parseSecretVaultTransferPayload } from '../../../shared/secrets';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

type VaultPasswordPromptRequest = {
  title: string;
  message: string;
  submitLabel: string;
  resolve: (value: string | null) => void;
};

export default function SettingsSection() {
  const locale = useLocale();
  const localeLabel = getLocaleLabel(locale);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [vaultPasswordPrompt, setVaultPasswordPrompt] =
    useState<VaultPasswordPromptRequest | null>(null);

  const promptVaultPassword = (config: {
    title: string;
    message: string;
    submitLabel: string;
  }): Promise<string | null> =>
    new Promise((resolve) => {
      setVaultPasswordPrompt({ ...config, resolve });
    });

  const resolveVaultPasswordPrompt = (value: string | null) => {
    setVaultPasswordPrompt((current) => {
      current?.resolve(value);
      return null;
    });
  };
  const storeUrl = chrome?.runtime?.id
    ? `https://chromewebstore.google.com/detail/${chrome.runtime.id}`
    : 'https://chromewebstore.google.com/';

  const downloadExportJson = async (payload: unknown) => {
    const content = JSON.stringify(payload, null, 2);
    const timestamp = new Date();
    const pad = (value: number, length = 2) => String(value).padStart(length, '0');
    const timezoneOffsetMinutes = -timestamp.getTimezoneOffset();
    const timezoneSign = timezoneOffsetMinutes >= 0 ? '+' : '-';
    const timezoneHours = pad(Math.floor(Math.abs(timezoneOffsetMinutes) / 60));
    const timezoneMinutes = pad(Math.abs(timezoneOffsetMinutes) % 60);
    const filename = `ladybrid-export-${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(
      timestamp.getDate(),
    )}T${pad(timestamp.getHours())}-${pad(timestamp.getMinutes())}-${pad(timestamp.getSeconds())}-${pad(
      timestamp.getMilliseconds(),
      3,
    )}${timezoneSign}${timezoneHours}-${timezoneMinutes}.json`;
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
      const globalSettings = await getGlobalSettings();
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
          const vaultPassword = await promptVaultPassword({
            title: t('sidepanel_settings_vault_prompt_title_export', 'Include vault passwords'),
            message: t(
              'sidepanel_settings_export_vault_password_prompt',
              'Enter your vault password to include saved passwords in the export.',
            ),
            submitLabel: t('sidepanel_settings_vault_prompt_submit', 'Continue'),
          });
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
        settings: globalSettings,
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
      if (parsed.settings) {
        await setGlobalSettings(parsed.settings);
      }
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
            vaultPassword = await promptVaultPassword({
              title: t('sidepanel_settings_vault_prompt_title_create', 'Create vault password'),
              message: t(
                'sidepanel_settings_import_vault_password_prompt_create',
                'Create a vault password (used to lock/unlock the imported password vault).',
              ),
              submitLabel: t('sidepanel_settings_vault_prompt_submit', 'Continue'),
            });
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
          vaultPassword = await promptVaultPassword({
            title: t('sidepanel_settings_vault_prompt_title_unlock', 'Unlock password vault'),
            message: t(
              'sidepanel_settings_import_vault_password_prompt_unlock',
              'This file contains password vault data. Enter your vault password to import saved passwords.',
            ),
            submitLabel: t('sidepanel_settings_vault_prompt_submit', 'Continue'),
          });
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

      <PasswordVaultManager />

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
      <PasswordPromptDialog
        open={Boolean(vaultPasswordPrompt)}
        title={vaultPasswordPrompt?.title ?? ''}
        message={vaultPasswordPrompt?.message ?? ''}
        submitLabel={vaultPasswordPrompt?.submitLabel}
        onSubmit={(value) => resolveVaultPasswordPrompt(value)}
        onCancel={() => resolveVaultPasswordPrompt(null)}
      />
    </section>
  );
}
