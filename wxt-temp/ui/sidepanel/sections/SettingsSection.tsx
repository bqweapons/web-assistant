import { Copy, Download, ExternalLink, Languages, Share2, Upload } from 'lucide-react';
import Card from '../components/Card';
import { LOCALE_OPTIONS, SupportedLocale, getLocaleLabel, setLocale, t, useLocale } from '../utils/i18n';

export default function SettingsSection() {
  const locale = useLocale();
  const localeLabel = getLocaleLabel(locale);

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
            <button type="button" className="btn-ghost gap-2 flex-1">
              <Upload className="h-4 w-4" />
              {t('sidepanel_settings_data_import', 'Import')}
            </button>
            <button type="button" className="btn-primary gap-2 flex-1">
              <Download className="h-4 w-4" />
              {t('sidepanel_settings_data_export', 'Export')}
            </button>
          </div>
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
            <button type="button" className="btn-primary gap-2">
              <Copy className="h-4 w-4" />
              {t('sidepanel_settings_share_copy', 'Copy link')}
            </button>
            <button type="button" className="btn-ghost gap-2">
              <ExternalLink className="h-4 w-4" />
              {t('sidepanel_settings_share_open', 'Open store')}
            </button>
          </div>
        </div>
      </Card>
    </section>
  );
}
