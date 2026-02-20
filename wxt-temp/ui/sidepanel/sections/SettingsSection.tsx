import { useRef, useState, type ChangeEvent } from 'react';
import { Copy, Download, ExternalLink, Languages, Share2, Upload } from 'lucide-react';
import Card from '../components/Card';
import { LOCALE_OPTIONS, SupportedLocale, getLocaleLabel, setLocale, t, useLocale } from '../utils/i18n';
import { getAllSitesData, setAllSitesData } from '../../../shared/storage';
import { buildExportPayload, mergeSitesData, parseImportPayload } from '../../../shared/importExport';

export default function SettingsSection() {
  const locale = useLocale();
  const localeLabel = getLocaleLabel(locale);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const storeUrl = chrome?.runtime?.id
    ? `https://chromewebstore.google.com/detail/${chrome.runtime.id}`
    : 'https://chromewebstore.google.com/';

  const handleExport = async () => {
    if (isExporting) {
      return;
    }
    setIsExporting(true);
    setFeedback(null);
    try {
      const sites = await getAllSitesData();
      const payload = buildExportPayload(sites);
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
      const parsed = parseImportPayload(raw);
      const currentSites = await getAllSitesData();
      const mergedSites = mergeSitesData(currentSites, parsed.sites);
      await setAllSitesData(mergedSites);
      const warningSuffix =
        parsed.summary.warnings.length > 0
          ? t('sidepanel_settings_feedback_import_warning_suffix', ' ({count} warning(s))').replace(
              '{count}',
              String(parsed.summary.warnings.length),
            )
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
          warningSuffix,
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
              {isImporting ? `${t('sidepanel_settings_data_import', 'Import')}...` : t('sidepanel_settings_data_import', 'Import')}
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
              {isExporting ? `${t('sidepanel_settings_data_export', 'Export')}...` : t('sidepanel_settings_data_export', 'Export')}
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
    </section>
  );
}
