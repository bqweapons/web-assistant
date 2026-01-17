import { Globe } from 'lucide-react';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import { t } from '../utils/i18n';

export default function OverviewSection() {
  const siteStats = [
    { site: 'file://', elements: 5, flows: 4, hidden: 0 },
    { site: 'https://note.com', elements: 4, flows: 0, hidden: 0 },
    { site: 'https://mail.google.com', elements: 2, flows: 0, hidden: 0 },
    { site: 'https://avanade.service-now.com', elements: 1, flows: 0, hidden: 0 },
    { site: 'https://pay.openai.com', elements: 1, flows: 0, hidden: 0 },
    { site: 'https://type.jp', elements: 1, flows: 0, hidden: 0 },
    { site: 'https://51cg1.com', elements: 0, flows: 0, hidden: 4 },
    { site: 'https://www.yahoo.co.jp', elements: 0, flows: 0, hidden: 2 },
    { site: 'https://missav.ai', elements: 0, flows: 0, hidden: 1 },
  ];

  const totals = siteStats.reduce(
    (acc, site) => ({
      elements: acc.elements + site.elements,
      flows: acc.flows + site.flows,
      hidden: acc.hidden + site.hidden,
    }),
    { elements: 0, flows: 0, hidden: 0 },
  );

  const sortedSites = [...siteStats].sort((a, b) => {
    const aTotal = a.elements + a.flows + a.hidden;
    const bTotal = b.elements + b.flows + b.hidden;
    return bTotal - aTotal;
  });
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
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          {t('sidepanel_overview_sites_count', '{count} sites').replace('{count}', String(siteStats.length))}
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
        <div className="divide-y divide-border">
          {sortedSites.map((site) => {
            const total = site.elements + site.flows + site.hidden;
            return (
              <div key={site.site} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <a
                      className="text-sm font-semibold text-card-foreground underline-offset-2 hover:underline"
                      href={site.site}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {site.site}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {t('sidepanel_overview_total_items', '{count} total items').replace(
                        '{count}',
                        String(total),
                      )}
                    </p>
                  </div>
                </div>
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
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
