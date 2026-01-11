import { useEffect, useMemo, useState } from 'react';
import { Check, Crosshair, ExternalLink, Link as LinkIcon, Search, Trash2, X } from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import SelectMenu from '../components/SelectMenu';
import { mockElements, mockFlows } from '../utils/mockData';

export default function ElementsSection() {
  const currentSite = 'all-sites';
  const [elements, setElements] = useState(mockElements);
  const [flows, setFlows] = useState(mockFlows);
  const actionClass = 'btn-icon h-8 w-8';
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const activeElement = elements.find((element) => element.id === activeElementId) ?? null;
  const [editElement, setEditElement] = useState(activeElement);
  const [flowDrawerOpen, setFlowDrawerOpen] = useState(false);
  const [draftFlow, setDraftFlow] = useState({
    name: '',
    description: '',
    steps: 0,
  });
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
      const haystack = `${element.text} ${element.type} ${element.pageUrl} ${element.selector} ${element.href || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [elements, normalizedQuery, typeFilter]);
  const elementsByPage = filteredElements.reduce<Record<string, typeof filteredElements>>((acc, element) => {
    const pageKey = element.pageUrl || element.siteUrl || 'unknown';
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
  const stylePresets = [
    { value: '', label: 'Custom', styles: null },
    {
      value: 'button-default',
      label: 'Primary',
      styles: {
        color: '#ffffff',
        backgroundColor: '#1b84ff',
        fontSize: '12px',
        fontWeight: '600',
        padding: '8px 16px',
        borderRadius: '8px',
      },
    },
    {
      value: 'button-outline',
      label: 'Outline',
      styles: {
        backgroundColor: 'transparent',
        color: '#2563eb',
        border: '2px solid #2563eb',
        padding: '8px 16px',
        borderRadius: '10px',
      },
    },
    {
      value: 'floating-card',
      label: 'Floating',
      styles: {
        backgroundColor: '#ffffff',
        color: '#0f172a',
        border: '1px solid rgba(15, 23, 42, 0.12)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
        position: 'relative',
      },
    },
    {
      value: 'link-default',
      label: 'Link',
      styles: {
        color: '#2563eb',
        textDecoration: 'underline',
      },
    },
    {
      value: 'area-default',
      label: 'Area',
      styles: {
        backgroundColor: 'transparent',
        color: '#0f172a',
        padding: '16px',
        borderRadius: '14px',
        width: '320px',
        minHeight: '180px',
      },
    },
  ];
  const areaChildCounts = useMemo(() => {
    return elements.reduce<Record<string, number>>((acc, element) => {
      if (element.containerId) {
        acc[element.containerId] = (acc[element.containerId] ?? 0) + 1;
      }
      return acc;
    }, {});
  }, [elements]);
  const actionFlowOptions = useMemo(
    () => [
      { value: '', label: 'Unassigned' },
      ...flows.map((flow) => ({
        value: flow.id,
        label: flow.name,
        rightLabel: `${flow.steps} steps`,
      })),
      { value: '__create__', label: 'Create new flow…' },
    ],
    [flows],
  );
  const styleFields = [
    { key: 'backgroundColor', label: 'Background color', placeholder: '#ffffff' },
    { key: 'color', label: 'Text color', placeholder: '#0f172a' },
    { key: 'border', label: 'Border', placeholder: '1px solid #000000' },
    { key: 'borderRadius', label: 'Border radius', placeholder: '8px' },
    { key: 'boxShadow', label: 'Box shadow', placeholder: '0 12px 32px rgba(15, 23, 42, 0.18)' },
    { key: 'fontSize', label: 'Font size', placeholder: '12px' },
    { key: 'fontWeight', label: 'Font weight', placeholder: '600' },
    { key: 'padding', label: 'Padding', placeholder: '8px 16px' },
    { key: 'position', label: 'CSS position', placeholder: 'absolute' },
    { key: 'width', label: 'Width', placeholder: '120px' },
    { key: 'height', label: 'Height', placeholder: '40px' },
    { key: 'left', label: 'Left', placeholder: '12px' },
    { key: 'top', label: 'Top', placeholder: '12px' },
    { key: 'zIndex', label: 'Z-index', placeholder: '999' },
  ];

  const formatTimestamp = (value?: number) => {
    if (!value) {
      return 'Unknown';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    const pad = (segment: number) => String(segment).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  };

  const handleCreateFlow = () => {
    const name = draftFlow.name.trim() || 'New flow';
    const description = draftFlow.description.trim();
    const nextFlow = {
      id: `flow-${Date.now()}`,
      name,
      description,
      site: activeElement?.siteUrl || 'site',
      steps: Number.isFinite(draftFlow.steps) ? Math.max(0, draftFlow.steps) : 0,
      updatedAt: formatTimestamp(Date.now()),
    };
    setFlows((prev) => [...prev, nextFlow]);
    setEditElement((prev) => (prev ? { ...prev, actionFlowId: nextFlow.id } : prev));
    setFlowDrawerOpen(false);
  };

  const getElementLabel = (element: typeof elements[number]) => {
    const text = element.text?.trim();
    if (text) {
      return text;
    }
    const selector = element.selector?.trim();
    if (selector) {
      return selector;
    }
    return `${element.type} element`;
  };

  const getPageHref = (pageUrl: string, siteUrl: string) => {
    if (pageUrl.startsWith('http://') || pageUrl.startsWith('https://') || pageUrl.startsWith('file://')) {
      return pageUrl;
    }
    const siteHasScheme =
      siteUrl.startsWith('http://') || siteUrl.startsWith('https://') || siteUrl.startsWith('file://');
    const siteRoot = siteUrl.replace(/\/$/, '');
    if (pageUrl.startsWith('/')) {
      return siteHasScheme ? `${siteRoot}${pageUrl}` : `https://${siteRoot}${pageUrl}`;
    }
    if (pageUrl.includes('/')) {
      return `https://${pageUrl}`;
    }
    if (siteHasScheme) {
      return siteUrl;
    }
    return `https://${siteRoot}`;
  };
  const getPageLabel = (pageUrl: string, siteUrl: string) => {
    if (!pageUrl) {
      return 'Unknown page';
    }
    const formatHostPath = (host: string, pathname: string) => {
      const cleanPath = pathname.replace(/^\/+/, '');
      return cleanPath ? `${host}/${cleanPath}` : host;
    };
    if (pageUrl.startsWith('http://') || pageUrl.startsWith('https://') || pageUrl.startsWith('file://')) {
      try {
        const url = new URL(pageUrl);
        if (url.protocol === 'file:') {
          const fileName = url.pathname.split('/').pop();
          return fileName || url.pathname || pageUrl;
        }
        const isRoot = url.pathname === '/' && !url.search && !url.hash;
        const hasExplicitTrailingSlash = pageUrl.endsWith('/') && !pageUrl.endsWith('://');
        if (isRoot) {
          const origin = `${url.protocol}//${url.host}`;
          return hasExplicitTrailingSlash ? `${origin}/` : origin;
        }
        return `${url.protocol}//${formatHostPath(url.host, url.pathname)}`;
      } catch {
        return pageUrl;
      }
    }
    if (pageUrl.startsWith('/')) {
      const siteHost = siteUrl.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');
      if (siteHost) {
        if (pageUrl === '/') {
          return `${siteHost}/`;
        }
        return formatHostPath(siteHost, pageUrl);
      }
      return pageUrl.replace(/^\/+/, '');
    }
    const [hostCandidate, ...rest] = pageUrl.split('/');
    if (rest.length > 0) {
      return formatHostPath(hostCandidate, `/${rest.join('/')}`);
    }
    return pageUrl;
  };
  const getElementDetail = (element: typeof elements[number]) => {
    const type = element.type.toLowerCase();
    if (type === 'button') {
      if (element.actionFlowId) {
        return `Action flow: ${element.actionFlowId}`;
      }
      return element.actionFlow ? 'Action flow: Configured' : 'Action flow: Unassigned';
    }
    if (type === 'link') {
      return `Link: ${element.href || 'Unassigned'}`;
    }
    if (type === 'area') {
      const count = areaChildCounts[element.id] ?? 0;
      return `Contains ${count} ${count === 1 ? 'element' : 'elements'}`;
    }
    return element.selector ? `Selector: ${element.selector}` : 'Detail: Not set';
  };
  const getElementDetailRows = (element: typeof elements[number]) => {
    const rows = [
      { label: 'Type', value: element.type },
      { label: 'Scope', value: element.scope || 'page' },
      { label: 'Site', value: element.siteUrl || 'Unknown' },
      { label: 'Page', value: getPageLabel(element.pageUrl, element.siteUrl || currentSite) },
      { label: 'Selector', value: element.selector || 'Not set' },
    ];
    const type = element.type.toLowerCase();
    if (type === 'button') {
      rows.push({
        label: 'Action flow',
        value: element.actionFlowId || (element.actionFlow ? 'Configured' : 'Not set'),
      });
    }
    if (type === 'link') {
      rows.push({ label: 'Link', value: element.href || 'Not set' });
    }
    if (type === 'area') {
      rows.push({ label: 'Layout', value: element.layout || 'row' });
    }
    rows.push({ label: 'Last updated', value: formatTimestamp(element.updatedAt) });
    return rows;
  };

  const detectStylePreset = (style: Record<string, string> = {}) => {
    const normalized = Object.keys(style).reduce<Record<string, string>>((acc, key) => {
      acc[key] = typeof style[key] === 'string' ? style[key].trim() : '';
      return acc;
    }, {});
    const match = stylePresets.find((preset) => {
      if (!preset.styles) {
        return false;
      }
      const entries = Object.entries(preset.styles);
      if (entries.length === 0) {
        return false;
      }
      return entries.every(([key, value]) => (normalized[key] || '').trim() === (value || '').trim());
    });
    return match?.value || '';
  };

  const applyStylePreset = (presetValue: string) => {
    if (!editElement) {
      return;
    }
    const preset = stylePresets.find((option) => option.value === presetValue);
    const nextStyle = preset?.styles ? { ...preset.styles } : {};
    setEditElement({
      ...editElement,
      stylePreset: presetValue,
      style: nextStyle,
    });
  };

  useEffect(() => {
    if (!activeElement) {
      setEditElement(null);
      return;
    }
    const resolvedStyle = activeElement.style || {};
    setEditElement({
      ...activeElement,
      text: activeElement.text || '',
      href: activeElement.href || '',
      selector: activeElement.selector || '',
      position: activeElement.position || 'append',
      actionFlowId: activeElement.actionFlowId || '',
      actionFlowLocked: Boolean(activeElement.actionFlowLocked),
      scope: activeElement.scope || 'page',
      floating: activeElement.floating !== false,
      linkTarget: activeElement.linkTarget || 'new-tab',
      layout: activeElement.layout || 'row',
      style: resolvedStyle,
      stylePreset: activeElement.stylePreset || detectStylePreset(resolvedStyle),
    });
  }, [activeElement]);

  useEffect(() => {
    if (!flowDrawerOpen) {
      return;
    }
    setDraftFlow({ name: '', description: '', steps: 0 });
  }, [flowDrawerOpen]);

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
                {type === 'all' ? 'All types' : `${type.slice(0, 1).toUpperCase()}${type.slice(1)}`}
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
          {pageEntries.map(([page, pageElements]) => {
            const pageSite = pageElements[0]?.siteUrl || currentSite;
            return (
              <div key={page} className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <LinkIcon className="h-3.5 w-3.5" />
                  </span>
                  <p className="truncate text-sm font-semibold text-card-foreground">
                    {getPageLabel(page, pageSite)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                    href={getPageHref(page, pageSite)}
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
                          {getElementLabel(element)}
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
                      <p className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(element.updatedAt)}</p>
                    </div>
                  </Card>
                ))}
              </div>
              </div>
            );
          })}
        </div>
      )}

      <Drawer
        open={Boolean(activeElement)}
        title={
          activeElement ? (
            <>
              <span className="badge-pill shrink-0">{activeElement.type}</span>
              <span>{getElementLabel(activeElement)}</span>
            </>
          ) : (
            'Element details'
          )
        }
        description="Update the element settings below."
        actions={
          <>
            <button
              type="button"
              className="btn-icon h-8 w-8"
              onClick={() => setActiveElementId(null)}
              aria-label="Cancel"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-icon h-8 w-8 border-transparent bg-primary text-primary-foreground hover:brightness-95"
              onClick={handleElementSave}
              aria-label="Save"
              title="Save"
            >
              <Check className="h-4 w-4" />
            </button>
          </>
        }
        showClose={false}
        onClose={() => setActiveElementId(null)}
      >
        {editElement ? (
          <div className="grid gap-3 text-xs text-muted-foreground">
            <label className="grid gap-1">
              <span>Name</span>
              <input
                className="input"
                value={editElement.text}
                onChange={(event) => setEditElement({ ...editElement, text: event.target.value })}
                placeholder="Element text"
              />
            </label>
            {/* <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={editElement.floating}
                onChange={(event) => setEditElement({ ...editElement, floating: event.target.checked })}
              />
              <span>Floating element</span>
            </label> */}
            {editElement.type.toLowerCase() === 'button' ? (
              <>
                <label className="grid gap-1">
                  <span>Action flow</span>
                  <SelectMenu
                    value={editElement.actionFlowId || ''}
                    options={actionFlowOptions}
                    onChange={(value) => {
                      if (value === '__create__') {
                        setFlowDrawerOpen(true);
                        return;
                      }
                      setEditElement({ ...editElement, actionFlowId: value });
                    }}
                  />
                </label>
              </>
            ) : null}
            {editElement.type.toLowerCase() === 'link' ? (
              <>
                <label className="grid gap-1">
                  <span>Link URL</span>
                  <input
                    className="input"
                    value={editElement.href}
                    onChange={(event) => setEditElement({ ...editElement, href: event.target.value })}
                    placeholder="https://example.com"
                  />
                </label>
                <label className="grid gap-1">
                  <span>Link target</span>
                  <SelectMenu
                    value={editElement.linkTarget || 'new-tab'}
                    options={[
                      { value: 'new-tab', label: 'Open in new tab' },
                      { value: 'same-tab', label: 'Open in same tab' },
                    ]}
                    onChange={(value) =>
                      setEditElement({
                        ...editElement,
                        linkTarget: value === 'same-tab' ? 'same-tab' : 'new-tab',
                      })
                    }
                  />
                </label>
              </>
            ) : null}
            {editElement.type.toLowerCase() === 'area' ? (
              <>
                <label className="grid gap-1">
                  <span>Layout</span>
                  <SelectMenu
                    value={editElement.layout || 'row'}
                    options={[
                      { value: 'row', label: 'Row' },
                      { value: 'column', label: 'Column' },
                    ]}
                    onChange={(value) =>
                      setEditElement({
                        ...editElement,
                        layout: value === 'column' ? 'column' : 'row',
                      })
                    }
                  />
                </label>
              </>
            ) : null}
            
            <label className="grid gap-1">
              <span>Scope</span>
              <SelectMenu
                value={editElement.scope || 'page'}
                options={[
                  { value: 'page', label: 'Page' },
                  { value: 'site', label: 'Site' },
                ]}
                onChange={(value) =>
                  setEditElement({ ...editElement, scope: value === 'site' ? 'site' : 'page' })
                }
              />
            </label>
            <div className="grid gap-2">
              <span className="text-xs font-semibold text-foreground">Styles</span>
              <label className="grid gap-1">
                <span>Style preset</span>
                <SelectMenu
                  value={editElement.stylePreset || ''}
                  options={stylePresets.map((preset) => ({
                    value: preset.value,
                    label: preset.label,
                  }))}
                  onChange={(value) => applyStylePreset(value)}
                />
              </label>
              {styleFields.map((field) => (
                <label key={field.key} className="grid gap-1">
                  <span>{field.label}</span>
                  <input
                    className="input"
                    value={editElement.style?.[field.key] || ''}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      const nextStyle = { ...(editElement.style || {}) };
                      if (nextValue) {
                        nextStyle[field.key] = nextValue;
                      } else {
                        delete nextStyle[field.key];
                      }
                      setEditElement({
                        ...editElement,
                        style: nextStyle,
                        stylePreset: detectStylePreset(nextStyle),
                      });
                    }}
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={flowDrawerOpen}
        title="New flow"
        description="Create a new action flow."
        actions={
          <>
            <button
              type="button"
              className="btn-icon h-8 w-8"
              onClick={() => setFlowDrawerOpen(false)}
              aria-label="Cancel"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-icon h-8 w-8 border-transparent bg-primary text-primary-foreground hover:brightness-95"
              onClick={handleCreateFlow}
              aria-label="Save"
              title="Save"
            >
              <Check className="h-4 w-4" />
            </button>
          </>
        }
        showClose={false}
        onClose={() => setFlowDrawerOpen(false)}
      >
        <div className="grid gap-3 text-xs text-muted-foreground">
          <label className="grid gap-1">
            <span>Name</span>
            <input
              className="input"
              value={draftFlow.name}
              onChange={(event) => setDraftFlow({ ...draftFlow, name: event.target.value })}
              placeholder="Flow name"
            />
          </label>
          <label className="grid gap-1">
            <span>Description</span>
            <textarea
              className="input"
              rows={2}
              value={draftFlow.description}
              onChange={(event) => setDraftFlow({ ...draftFlow, description: event.target.value })}
              placeholder="What does this flow do?"
            />
          </label>
          <label className="grid gap-1">
            <span>Steps</span>
            <input
              className="input"
              type="number"
              min="0"
              value={draftFlow.steps}
              onChange={(event) =>
                setDraftFlow({ ...draftFlow, steps: Number(event.target.value) || 0 })
              }
            />
          </label>
        </div>
      </Drawer>
    </div>
  );
}
