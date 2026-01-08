import { useEffect, useMemo, useState } from 'react';
import { Crosshair, ExternalLink, Link as LinkIcon, Search, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import { mockElements } from '../utils/mockData';

export default function ElementsSection() {
  const currentSite = 'all-sites';
  const [elements, setElements] = useState(mockElements);
  const actionClass = 'btn-icon h-8 w-8';
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const activeElement = elements.find((element) => element.id === activeElementId) ?? null;
  const [editElement, setEditElement] = useState(activeElement);
  const typeOptions = useMemo(() => {
    const types = new Set(elements.map((element) => element.type));
    return ['all', ...Array.from(types).sort()];
  }, [elements]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredElements = useMemo(() => {
    return elements.filter((element) => {
      if (typeFilter !== 'all' && element.type !== typeFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = `${element.label} ${element.type} ${element.page}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [elements, normalizedQuery, typeFilter]);
  const elementsByPage = filteredElements.reduce<Record<string, typeof filteredElements>>((acc, element) => {
    const pageKey = element.page || 'unknown';
    if (!acc[pageKey]) {
      acc[pageKey] = [];
    }
    acc[pageKey].push(element);
    return acc;
  }, {});
  const pageEntries = Object.entries(elementsByPage).sort((a, b) => a[0].localeCompare(b[0]));
  const pageCount = pageEntries.length;
  const totalCount = elements.length;
  const filteredCount = filteredElements.length;
  const showClear = Boolean(searchQuery) || typeFilter !== 'all';

  const getPageHref = (page: string, site: string) => {
    if (page.startsWith('http://') || page.startsWith('https://') || page.startsWith('file://')) {
      return page;
    }
    const siteHasScheme = site.startsWith('http://') || site.startsWith('https://') || site.startsWith('file://');
    const siteRoot = site.replace(/\/$/, '');
    if (page.startsWith('/')) {
      return siteHasScheme ? `${siteRoot}${page}` : `https://${siteRoot}${page}`;
    }
    if (page.includes('/')) {
      return `https://${page}`;
    }
    if (siteHasScheme) {
      return site;
    }
    return `https://${siteRoot}`;
  };
  const getPageLabel = (page: string, site: string) => {
    if (!page) {
      return 'Unknown page';
    }
    const formatHostPath = (host: string, pathname: string) => {
      const cleanPath = pathname.replace(/^\/+/, '');
      return cleanPath ? `${host}/${cleanPath}` : host;
    };
    if (page.startsWith('http://') || page.startsWith('https://') || page.startsWith('file://')) {
      try {
        const url = new URL(page);
        if (url.protocol === 'file:') {
          const fileName = url.pathname.split('/').pop();
          return fileName || url.pathname || page;
        }
        return formatHostPath(url.host, url.pathname);
      } catch {
        return page;
      }
    }
    if (page.startsWith('/')) {
      const siteHost = site.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');
      if (siteHost) {
        return formatHostPath(siteHost, page);
      }
      return page.replace(/^\/+/, '');
    }
    const [hostCandidate, ...rest] = page.split('/');
    if (rest.length > 0) {
      return formatHostPath(hostCandidate, `/${rest.join('/')}`);
    }
    return page;
  };
  const getElementDetail = (element: typeof elements[number]) => {
    const type = element.type.toLowerCase();
    if (type === 'button') {
      return `Flow: ${element.flowName || 'Unassigned'}`;
    }
    if (type === 'link') {
      return `Link: ${element.url || 'Unassigned'}`;
    }
    if (type === 'area') {
      const count = typeof element.areaCount === 'number' ? element.areaCount : 0;
      return `Contains ${count} items`;
    }
    return 'Detail: Not set';
  };
  const getElementDetailRows = (element: typeof elements[number]) => {
    const rows = [
      { label: 'Type', value: element.type },
      { label: 'Scope', value: element.scope },
      { label: 'Site', value: element.site || 'Unknown' },
      { label: 'Page', value: getPageLabel(element.page, element.site || currentSite) },
    ];
    const type = element.type.toLowerCase();
    if (type === 'button') {
      rows.push({ label: 'Flow', value: element.flowName || 'Not set' });
    }
    if (type === 'link') {
      rows.push({ label: 'Link', value: element.url || 'Not set' });
    }
    if (type === 'area') {
      const count = typeof element.areaCount === 'number' ? element.areaCount : 0;
      rows.push({ label: 'Contains', value: `${count} items` });
    }
    rows.push({ label: 'Last updated', value: element.updatedAt });
    return rows;
  };

  useEffect(() => {
    if (!activeElement) {
      setEditElement(null);
      return;
    }
    setEditElement({
      ...activeElement,
      flowName: activeElement.flowName || '',
      url: activeElement.url || '',
      linkTarget: activeElement.linkTarget || 'new-tab',
      tooltipPosition: activeElement.tooltipPosition || 'top',
      tooltipPersistent: Boolean(activeElement.tooltipPersistent),
      layout: activeElement.layout || 'row',
      areaCount: typeof activeElement.areaCount === 'number' ? activeElement.areaCount : 0,
    });
  }, [activeElement]);

  const handleElementSave = () => {
    if (!editElement) {
      return;
    }
    setElements((prev) =>
      prev.map((item) => (item.id === editElement.id ? { ...item, ...editElement } : item)),
    );
    setActiveElementId(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-card-foreground">Elements</h2>
          <p className="text-xs text-muted-foreground">Find saved elements across pages.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input pl-9"
            type="search"
            placeholder="Search by name, type, or page"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input select w-full sm:w-40"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type === 'all' ? 'All types' : type}
              </option>
            ))}
          </select>
          {showClear ? (
            <button
              type="button"
              className="btn-ghost px-3"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {elements.length === 0 ? (
        <Card className="border-dashed bg-muted text-center text-sm text-muted-foreground">
          No elements yet. Create your first element to get started.
        </Card>
      ) : filteredElements.length === 0 ? (
        <Card className="border-dashed bg-muted text-center text-sm text-muted-foreground">
          No matches. Try a different search or filter.
        </Card>
      ) : (
        <div className="grid gap-3">
          {pageEntries.map(([page, pageElements]) => (
            <div key={page} className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <LinkIcon className="h-3.5 w-3.5" />
                  </span>
                  <p className="truncate text-sm font-semibold text-card-foreground">
                    {getPageLabel(page, currentSite)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                    href={getPageHref(page, currentSite)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                </div>
              </div>
              <div className="grid gap-2">
                {pageElements.map((element) => (
                  <Card
                    key={element.id}
                    className="p-4"
                    onClick={() => setActiveElementId(element.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="badge-pill shrink-0">{element.type}</span>
                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-card-foreground">
                          {element.label || `${element.type} element`}
                        </h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className={actionClass}
                          aria-label="Locate element"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Crosshair className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={`${actionClass} btn-icon-danger`}
                          aria-label="Delete element"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {getElementDetail(element)}
                      </p>
                      <p className="shrink-0 text-xs text-muted-foreground">{element.updatedAt}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Drawer
        open={Boolean(activeElement)}
        title={activeElement?.label || `${activeElement?.type ?? 'Element'} details`}
        description="Update the element settings below."
        onClose={() => setActiveElementId(null)}
      >
        {editElement ? (
          <div className="grid gap-3 text-xs text-muted-foreground">
            <label className="grid gap-1">
              <span>Name</span>
              <input
                className="input"
                value={editElement.label}
                onChange={(event) => setEditElement({ ...editElement, label: event.target.value })}
                placeholder="Element name"
              />
            </label>
            <div className="grid gap-1">
              <span>Type</span>
              <p className="text-sm font-semibold text-foreground">{editElement.type}</p>
            </div>
            <label className="grid gap-1">
              <span>Scope</span>
              <select
                className="input select"
                value={editElement.scope}
                onChange={(event) =>
                  setEditElement({ ...editElement, scope: event.target.value === 'site' ? 'site' : 'page' })
                }
              >
                <option value="page">Page</option>
                <option value="site">Site</option>
              </select>
            </label>
            {editElement.type.toLowerCase() === 'button' ? (
              <label className="grid gap-1">
                <span>Flow name</span>
                <input
                  className="input"
                  value={editElement.flowName}
                  onChange={(event) => setEditElement({ ...editElement, flowName: event.target.value })}
                  placeholder="Select or name a flow"
                />
              </label>
            ) : null}
            {editElement.type.toLowerCase() === 'link' ? (
              <>
                <label className="grid gap-1">
                  <span>Link URL</span>
                  <input
                    className="input"
                    value={editElement.url}
                    onChange={(event) => setEditElement({ ...editElement, url: event.target.value })}
                    placeholder="https://example.com"
                  />
                </label>
                <label className="grid gap-1">
                  <span>Link target</span>
                  <select
                    className="input select"
                    value={editElement.linkTarget}
                    onChange={(event) =>
                      setEditElement({
                        ...editElement,
                        linkTarget: event.target.value === 'same-tab' ? 'same-tab' : 'new-tab',
                      })
                    }
                  >
                    <option value="new-tab">Open in new tab</option>
                    <option value="same-tab">Open in same tab</option>
                  </select>
                </label>
              </>
            ) : null}
            {editElement.type.toLowerCase() === 'tooltip' ? (
              <>
                <label className="grid gap-1">
                  <span>Tooltip position</span>
                  <select
                    className="input select"
                    value={editElement.tooltipPosition}
                    onChange={(event) =>
                      setEditElement({
                        ...editElement,
                        tooltipPosition: event.target.value as 'top' | 'right' | 'bottom' | 'left',
                      })
                    }
                  >
                    <option value="top">Top</option>
                    <option value="right">Right</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                  </select>
                </label>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={editElement.tooltipPersistent}
                    onChange={(event) =>
                      setEditElement({ ...editElement, tooltipPersistent: event.target.checked })
                    }
                  />
                  <span>Keep tooltip visible</span>
                </label>
              </>
            ) : null}
            {editElement.type.toLowerCase() === 'area' ? (
              <>
                <label className="grid gap-1">
                  <span>Layout</span>
                  <select
                    className="input select"
                    value={editElement.layout}
                    onChange={(event) =>
                      setEditElement({
                        ...editElement,
                        layout: event.target.value === 'column' ? 'column' : 'row',
                      })
                    }
                  >
                    <option value="row">Row</option>
                    <option value="column">Column</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span>Contained items</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={editElement.areaCount}
                    onChange={(event) =>
                      setEditElement({
                        ...editElement,
                        areaCount: Number(event.target.value) || 0,
                      })
                    }
                  />
                </label>
              </>
            ) : null}
            <div className="grid gap-1">
              <span>Last updated</span>
              <p className="text-sm text-foreground">{editElement.updatedAt}</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setActiveElementId(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleElementSave}>
                Save changes
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
