import { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, RefreshCw, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { t } from '../utils/i18n';
import { getAllSitesData, setAllSitesData, STORAGE_KEY, type SiteData } from '../../../shared/storage';

export default function OverviewSection() {
  const [siteStats, setSiteStats] = useState<
    Array<{ siteKey: string; elements: number; flows: number; hidden: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [deletingSiteKey, setDeletingSiteKey] = useState('');
  const [actionError, setActionError] = useState('');

  const toCount = (value: unknown) => (Array.isArray(value) ? value.length : 0);

  const buildStats = (sites: Record<string, SiteData>) => {
    return Object.entries(sites)
      .map(([siteKey, data]) => ({
        siteKey,
        elements: toCount(data?.elements),
        flows: toCount(data?.flows),
        hidden: toCount(data?.hidden),
      }))
      .filter((item) => item.elements + item.flows + item.hidden > 0);
  };

  const refreshStats = useCallback(async () => {
    setLoading(true);
    setActionError('');
    try {
      const sites = await getAllSitesData();
      setSiteStats(buildStats(sites));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStats().catch(() => undefined);
  }, [refreshStats]);

  useEffect(() => {
    const storage = chrome?.storage?.onChanged;
    if (!storage) {
      return;
    }
    const handleStorageChange = (changes: Record<string, unknown>, areaName: string) => {
      if (areaName !== 'local' || !changes[STORAGE_KEY]) {
        return;
      }
      refreshStats().catch(() => undefined);
    };
    storage.addListener(handleStorageChange);
    return () => storage.removeListener(handleStorageChange);
  }, [refreshStats]);

  const getSiteHref = (siteKey: string) => {
    if (!siteKey) {
      return '';
    }
    if (siteKey.startsWith('http://') || siteKey.startsWith('https://') || siteKey.startsWith('file://')) {
      return siteKey;
    }
    if (siteKey.startsWith('/')) {
      return `file://${siteKey}`;
    }
    return `https://${siteKey}`;
  };

  const totals = siteStats.reduce(
    (acc, site) => ({
      elements: acc.elements + site.elements,
      flows: acc.flows + site.flows,
      hidden: acc.hidden + site.hidden,
    }),
    { elements: 0, flows: 0, hidden: 0 },
  );

  const sortedSites = useMemo(
    () =>
      [...siteStats].sort((a, b) => {
        const aTotal = a.elements + a.flows + a.hidden;
        const bTotal = b.elements + b.flows + b.hidden;
        if (bTotal !== aTotal) {
          return bTotal - aTotal;
        }
        return a.siteKey.localeCompare(b.siteKey);
      }),
    [siteStats],
  );

  const handleDeleteSite = useCallback(
    async (siteKey: string) => {
      const confirmed = window.confirm(
        t('sidepanel_overview_delete_site_confirm', 'Delete all saved data for this site? This cannot be undone.')
          .replace('{site}', siteKey),
      );
      if (!confirmed) {
        return;
      }
      setDeletingSiteKey(siteKey);
      setActionError('');
      try {
        const sites = await getAllSitesData();
        if (!sites[siteKey]) {
          return;
        }
        const next = { ...sites };
        delete next[siteKey];
        await setAllSitesData(next);
        await refreshStats();
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : t('sidepanel_overview_delete_site_error', 'Failed to delete site data. Please try again.'),
        );
      } finally {
        setDeletingSiteKey('');
      }
    },
    [refreshStats],
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-card-foreground">
            {t('sidepanel_overview_title', 'Overview')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('sidepanel_overview_subtitle', 'Summary by site from the latest export snapshot.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-icon h-7 w-7"
            onClick={() => refreshStats().catch(() => undefined)}
            aria-label={t('sidepanel_action_refresh', 'Refresh')}
            title={t('sidepanel_action_refresh', 'Refresh')}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            {t('sidepanel_overview_sites_count', '{count} sites').replace('{count}', String(siteStats.length))}
          </div>
        </div>
      </div>

      <div className="grid gap-2 grid-cols-3">
        <StatCard label={t('sidepanel_tab_elements', 'Elements')} value={String(totals.elements)} />
        <StatCard label={t('sidepanel_tab_flows', 'Flows')} value={String(totals.flows)} />
        <StatCard label={t('sidepanel_tab_hidden', 'Hidden')} value={String(totals.hidden)} />
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">
              {t('sidepanel_overview_sites_title', 'Sites')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('sidepanel_overview_sites_subtitle', 'Totals grouped by site.')}
            </p>
          </div>
        </div>
        {actionError ? (
          <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {actionError}
          </div>
        ) : null}
        <div className="divide-y divide-border">
          {sortedSites.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              {t('sidepanel_overview_empty', 'No saved site data yet.')}
            </div>
          ) : null}
          {sortedSites.map((site) => {
            const total = site.elements + site.flows + site.hidden;
            const href = getSiteHref(site.siteKey);
            return (
              <div key={site.siteKey} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <a className="text-sm font-semibold text-card-foreground underline-offset-2 hover:underline" href={href} target="_blank" rel="noreferrer">
                      {site.siteKey}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {t('sidepanel_overview_total_items', '{count} total items').replace(
                        '{count}',
                        String(total),
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1">
                    {t('sidepanel_overview_elements_count', '{count} elements').replace(
                      '{count}',
                      String(site.elements),
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1">
                    {t('sidepanel_overview_flows_count', '{count} flows').replace(
                      '{count}',
                      String(site.flows),
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1">
                    {t('sidepanel_overview_hidden_count', '{count} hidden').replace(
                      '{count}',
                      String(site.hidden),
                    )}
                  </span>
                  </div>
                  <button
                    type="button"
                    className="btn-icon btn-icon-danger h-8 w-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => {
                      void handleDeleteSite(site.siteKey);
                    }}
                    aria-label={t('sidepanel_overview_delete_site', 'Delete site data')}
                    title={t('sidepanel_overview_delete_site', 'Delete site data')}
                    disabled={Boolean(deletingSiteKey) || loading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
