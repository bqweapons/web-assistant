import { useEffect, useMemo, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AArrowDown,
  AArrowUp,
  Bold,
  Check,
  ChevronDown,
  Crosshair,
  ExternalLink,
  Italic,
  Link as LinkIcon,
  Search,
  Trash2,
  Underline,
  X,
} from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import FlowDrawer from '../components/FlowDrawer';
import FlowStepsBuilder from '../components/FlowStepsBuilder';
import SelectMenu from '../components/SelectMenu';
import { mockElements, mockFlows } from '../utils/mockData';
import { t, useLocale } from '../utils/i18n';

export default function ElementsSection() {
  const locale = useLocale();
  const currentSite = 'all-sites';
  const [elements, setElements] = useState(mockElements);
  const [flows, setFlows] = useState(mockFlows);
  const actionClass = 'btn-icon h-8 w-8';
  const selectButtonClass = 'btn-ghost h-9 w-full justify-between px-2 text-xs';
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
  const stylePresets: Array<{ value: string; label: string; styles: Record<string, string> | null }> = [
      { value: '', label: t('sidepanel_elements_style_custom', 'Custom'), styles: null },
    {
      value: 'button-default',
      label: t('sidepanel_elements_style_primary', 'Primary'),
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
      label: t('sidepanel_elements_style_outline', 'Outline'),
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
      label: t('sidepanel_elements_style_floating', 'Floating'),
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
      label: t('sidepanel_elements_style_link', 'Link'),
      styles: {
        color: '#2563eb',
        textDecoration: 'underline',
      },
    },
    {
      value: 'area-default',
      label: t('sidepanel_elements_style_area', 'Area'),
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
  const normalizeSiteKey = (value: string) =>
    value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');
  const flowSiteKey = useMemo(
    () => normalizeSiteKey(editElement?.siteUrl || activeElement?.siteUrl || ''),
    [editElement?.siteUrl, activeElement?.siteUrl],
  );
  const filteredFlows = useMemo(() => {
    if (!flowSiteKey) {
      return flows;
    }
    return flows.filter((flow) => normalizeSiteKey(flow.site) === flowSiteKey);
  }, [flows, flowSiteKey]);
  const actionFlowOptions = useMemo(
    () => [
      { value: '__create__', label: t('sidepanel_flows_create_new', 'Create new flow…'), sticky: true },
      { value: '', label: t('sidepanel_field_unassigned', 'Unassigned') },
      ...filteredFlows.map((flow) => ({
        value: flow.id,
        label: flow.name,
        rightLabel: t('sidepanel_steps_count', '{count} steps').replace('{count}', String(flow.steps)),
      })),
    ],
    [filteredFlows, locale],
  );
  const positionOptions = [
    { value: '', label: t('sidepanel_elements_position_auto', 'Auto') },
    { value: 'static', label: t('sidepanel_elements_position_static', 'Static') },
    { value: 'relative', label: t('sidepanel_elements_position_relative', 'Relative') },
    { value: 'absolute', label: t('sidepanel_elements_position_absolute', 'Absolute') },
    { value: 'fixed', label: t('sidepanel_elements_position_fixed', 'Fixed') },
    { value: 'sticky', label: t('sidepanel_elements_position_sticky', 'Sticky') },
  ];
  const shadowOptions = [
    { value: '', label: t('sidepanel_elements_shadow_none', 'None') },
    { value: '0 12px 32px rgba(15, 23, 42, 0.18)', label: t('sidepanel_elements_shadow_soft', 'Soft') },
    { value: '0 8px 24px rgba(15, 23, 42, 0.24)', label: t('sidepanel_elements_shadow_medium', 'Medium') },
    { value: '0 4px 12px rgba(15, 23, 42, 0.3)', label: t('sidepanel_elements_shadow_strong', 'Strong') },
  ];
  const customCssOrder = [
    'backgroundColor',
    'color',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'textDecoration',
    'textAlign',
    'border',
    'borderRadius',
    'boxShadow',
    'padding',
    'position',
    'width',
    'height',
    'left',
    'top',
    'zIndex',
  ];
  const defaultColorSwatches = [
    { label: t('sidepanel_color_transparent', 'Transparent'), value: 'transparent' },
    { label: t('sidepanel_color_black', 'Black'), value: '#000000' },
    { label: t('sidepanel_color_white', 'White'), value: '#ffffff' },
    { label: t('sidepanel_color_blue', 'Blue'), value: '#2563eb' },
    { label: t('sidepanel_color_red', 'Red'), value: '#ef4444' },
    { label: t('sidepanel_color_green', 'Green'), value: '#10b981' },
    { label: t('sidepanel_color_orange', 'Orange'), value: '#f59e0b' },
    { label: t('sidepanel_color_purple', 'Purple'), value: '#8b5cf6' },
  ];

  const formatTimestamp = (value?: number) => {
    if (!value) {
      return t('sidepanel_label_unknown', 'Unknown');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t('sidepanel_label_unknown', 'Unknown');
    }
    const pad = (segment: number) => String(segment).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  };

  const handleCreateFlow = () => {
    const name = draftFlow.name.trim() || t('sidepanel_flows_new_default', 'New flow');
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

  const getFlowStepCount = (value: number | unknown[]) => {
    if (Array.isArray(value)) {
      return value.length;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const renderFlowSummary = (steps: number, onSave: () => void) => (
    <>
      <p className="text-xs font-semibold text-muted-foreground">
        {t('sidepanel_flows_summary_title', 'Summary')}
      </p>
      <p className="text-sm text-foreground">
        {t('sidepanel_steps_count', '{count} steps').replace('{count}', String(steps))}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary text-xs" onClick={onSave}>
          {t('sidepanel_action_save', 'Save')}
        </button>
        <button type="button" className="btn-primary text-xs" disabled>
          {t('sidepanel_action_save_run', 'Save & Run')}
        </button>
        <button type="button" className="btn-primary text-xs" disabled>
          {t('sidepanel_action_run', 'Run')}
        </button>
      </div>
    </>
  );

  const getElementLabel = (element: typeof elements[number]) => {
    const text = element.text?.trim();
    if (text) {
      return text;
    }
    const selector = element.selector?.trim();
    if (selector) {
      return selector;
    }
    return t('sidepanel_elements_default_label', '{type} element').replace(
      '{type}',
      getElementTypeLabel(element.type),
    );
  };

  const getElementTypeLabel = (value: string) => {
    const normalized = value.toLowerCase();
    if (normalized === 'button') {
      return t('sidepanel_element_type_button', 'Button');
    }
    if (normalized === 'link') {
      return t('sidepanel_element_type_link', 'Link');
    }
    if (normalized === 'area') {
      return t('sidepanel_element_type_area', 'Area');
    }
    return value;
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
      return t('sidepanel_label_unknown_page', 'Unknown page');
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
        return t('sidepanel_elements_action_flow_value', 'Action flow: {value}').replace(
          '{value}',
          element.actionFlowId,
        );
      }
      return element.actionFlow
        ? t('sidepanel_elements_action_flow_configured', 'Action flow: Configured')
        : t('sidepanel_elements_action_flow_unassigned', 'Action flow: Unassigned');
    }
    if (type === 'link') {
      return t('sidepanel_elements_link_value', 'Link: {value}').replace(
        '{value}',
        element.href || t('sidepanel_field_unassigned', 'Unassigned'),
      );
    }
    if (type === 'area') {
      const count = areaChildCounts[element.id] ?? 0;
      return t('sidepanel_elements_contains_count', 'Contains {count} elements').replace(
        '{count}',
        String(count),
      );
    }
    return element.selector
      ? t('sidepanel_elements_selector_value', 'Selector: {value}').replace('{value}', element.selector)
      : t('sidepanel_elements_detail_not_set', 'Detail: Not set');
  };
  const getElementDetailRows = (element: typeof elements[number]) => {
    const rows = [
      { label: t('sidepanel_field_type', 'Type'), value: getElementTypeLabel(element.type) },
      {
        label: t('sidepanel_field_scope', 'Scope'),
        value:
          element.scope === 'site'
            ? t('sidepanel_scope_site', 'Site')
            : element.scope === 'global'
              ? t('sidepanel_scope_global', 'Global')
              : t('sidepanel_scope_page', 'Page'),
      },
      { label: t('sidepanel_field_site', 'Site'), value: element.siteUrl || t('sidepanel_label_unknown', 'Unknown') },
      { label: t('sidepanel_field_page', 'Page'), value: getPageLabel(element.pageUrl, element.siteUrl || currentSite) },
      { label: t('sidepanel_field_selector', 'Selector'), value: element.selector || t('sidepanel_field_not_set', 'Not set') },
    ];
    const type = element.type.toLowerCase();
    if (type === 'button') {
      rows.push({
        label: t('sidepanel_field_action_flow', 'Action flow'),
        value:
          element.actionFlowId ||
          (element.actionFlow
            ? t('sidepanel_field_configured', 'Configured')
            : t('sidepanel_field_not_set', 'Not set')),
      });
    }
    if (type === 'link') {
      rows.push({
        label: t('sidepanel_field_link', 'Link'),
        value: element.href || t('sidepanel_field_not_set', 'Not set'),
      });
    }
    if (type === 'area') {
      rows.push({
        label: t('sidepanel_field_layout', 'Layout'),
        value:
          element.layout === 'column'
            ? t('sidepanel_layout_column', 'Column')
            : t('sidepanel_layout_row', 'Row'),
      });
    }
    rows.push({
      label: t('sidepanel_field_last_updated', 'Last updated'),
      value: formatTimestamp(element.updatedAt),
    });
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

  const toKebabCase = (value: string) => value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

  const formatCustomCss = (rules: Record<string, string>) => {
    const entries: string[] = [];
    const used = new Set<string>();
    const pushEntry = (key: string) => {
      const rawValue = rules[key];
      if (!rawValue) {
        return;
      }
      const value = rawValue.trim();
      if (!value) {
        return;
      }
      entries.push(`${toKebabCase(key)}: ${value};`);
      used.add(key);
    };
    customCssOrder.forEach(pushEntry);
    Object.keys(rules).forEach((key) => {
      if (!used.has(key)) {
        pushEntry(key);
      }
    });
    return entries.join('\n');
  };

  const applyStylePreset = (presetValue: string) => {
    if (!editElement) {
      return;
    }
    const preset = stylePresets.find((option) => option.value === presetValue);
    const nextStyle = preset?.styles ? { ...preset.styles } : {};
    const nextCustomCss = preset?.styles ? formatCustomCss(preset.styles) : '';
    setEditElement({
      ...editElement,
      stylePreset: presetValue,
      style: nextStyle,
      customCss: nextCustomCss,
    });
  };

  const parseCustomCss = (raw: string) => {
    const rules: Record<string, string> = {};
    raw
      .split(';')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .forEach((segment) => {
        const [property, ...rest] = segment.split(':');
        if (!property || rest.length === 0) {
          return;
        }
        const value = rest.join(':').trim();
        if (!value) {
          return;
        }
        const key = property
          .trim()
          .toLowerCase()
          .replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
        if (!key) {
          return;
        }
        rules[key] = value;
      });
    return rules;
  };

  const customStyleOverrides = useMemo(
    () => (editElement?.customCss ? parseCustomCss(editElement.customCss) : {}),
    [editElement?.customCss],
  );

  const applyCustomCssUpdates = (updates: Record<string, string | undefined>) => {
    if (!editElement) {
      return;
    }
    const currentCustom = parseCustomCss(editElement.customCss || '');
    const nextCustom = { ...currentCustom };
    Object.entries(updates).forEach(([key, value]) => {
      const nextValue = value?.trim();
      if (nextValue) {
        nextCustom[key] = nextValue;
      } else {
        delete nextCustom[key];
      }
    });
    const nextCustomCss = formatCustomCss(nextCustom);
    const nextStyle = { ...(editElement.style || {}) };
    Object.entries(updates).forEach(([key, value]) => {
      const nextValue = value?.trim();
      if (nextValue) {
        nextStyle[key] = nextValue;
      } else {
        delete nextStyle[key];
      }
    });
    setEditElement({
      ...editElement,
      customCss: nextCustomCss,
      style: nextStyle,
      stylePreset: detectStylePreset(nextStyle),
    });
  };

  const getStyleValue = (key: string) => {
    if (customStyleOverrides[key] !== undefined) {
      return customStyleOverrides[key];
    }
    return editElement?.style?.[key] || '';
  };

  const getNumericValue = (value: string) => {
    const match = value.match(/-?\d+(\.\d+)?/);
    return match ? match[0] : '';
  };

  const getNumericStyleValue = (key: string) => getNumericValue(getStyleValue(key));

  const updateNumericStyle = (key: string, rawValue: string, unit: string) => {
    const trimmed = rawValue.trim();
    applyCustomCssUpdates({ [key]: trimmed ? `${trimmed}${unit}` : '' });
  };

  const adjustNumericStyle = (key: string, delta: number, unit: string, fallback: number) => {
    const currentRaw = getNumericStyleValue(key);
    const current = currentRaw ? Number(currentRaw) : fallback;
    const next = Number.isFinite(current) ? current + delta : fallback + delta;
    applyCustomCssUpdates({ [key]: `${next}${unit}` });
  };

  const normalizeHex = (raw: string) => {
    const value = raw.trim();
    if (!value.startsWith('#')) {
      return '';
    }
    const hex = value.slice(1);
    if (hex.length === 3) {
      return `#${hex
        .split('')
        .map((ch) => `${ch}${ch}`)
        .join('')}`;
    }
    if (hex.length === 4) {
      return `#${hex
        .slice(0, 3)
        .split('')
        .map((ch) => `${ch}${ch}`)
        .join('')}`;
    }
    if (hex.length === 6) {
      return `#${hex}`;
    }
    if (hex.length === 8) {
      return `#${hex.slice(0, 6)}`;
    }
    return '';
  };

  const colorToHex = (value: string) => {
    const normalized = value.trim();
    const hex = normalizeHex(normalized);
    if (hex) {
      return hex;
    }
    if (!normalized) {
      return '';
    }
    if (typeof document === 'undefined') {
      return '';
    }
    const test = document.createElement('div');
    test.style.color = '';
    test.style.color = normalized;
    if (!test.style.color) {
      return '';
    }
    document.body.appendChild(test);
    const rgb = getComputedStyle(test).color;
    test.remove();
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([.\d]+))?\)/);
    if (!match) {
      return '';
    }
    const [, r, g, b, a] = match;
    if (a !== undefined && Number(a) === 0) {
      return '';
    }
    const toHex = (num: string) => Number(num).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const resolveColorValue = (value: string, fallback: string) => {
    const hex = colorToHex(value);
    if (hex) {
      return hex;
    }
    const fallbackHex = colorToHex(fallback);
    if (fallbackHex) {
      return fallbackHex;
    }
    return '#ffffff';
  };

  const fontWeightValue = getStyleValue('fontWeight');
  const isBold = fontWeightValue === 'bold' || Number(fontWeightValue) >= 600;
  const isItalic = getStyleValue('fontStyle') === 'italic';
  const decorationValue = getStyleValue('textDecoration');
  const isUnderline = decorationValue.includes('underline');
  const textAlignValue = getStyleValue('textAlign') || 'left';
  const fontSizeValue = getNumericStyleValue('fontSize');
  const textColorValue = getStyleValue('color');
  const backgroundColorValue = getStyleValue('backgroundColor');
  const borderValue = getStyleValue('border');
  const borderRadiusValue = getNumericStyleValue('borderRadius');
  const boxShadowValue = getStyleValue('boxShadow');
  const paddingValue = getStyleValue('padding');
  const positionValue = getStyleValue('position');
  const widthValue = getNumericStyleValue('width');
  const heightValue = getNumericStyleValue('height');
  const leftValue = getNumericStyleValue('left');
  const topValue = getNumericStyleValue('top');
  const zIndexValue = getNumericStyleValue('zIndex');

  const renderColorSwatches = (fieldKey: string) =>
    defaultColorSwatches.map((swatch) => {
      const isTransparent = swatch.value === 'transparent';
      return (
        <button
          key={`${fieldKey}-${swatch.value}`}
          type="button"
          className="h-5.5 w-5.5 shrink-0 cursor-pointer rounded-md border border-border"
          title={swatch.label}
          aria-label={swatch.label}
          onClick={() => applyCustomCssUpdates({ [fieldKey]: swatch.value })}
          style={
            isTransparent
              ? {
                  backgroundImage:
                    'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                  backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0',
                  backgroundSize: '6px 6px',
                  backgroundColor: '#ffffff',
                }
              : { backgroundColor: swatch.value }
          }
        />
      );
    });

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
      customCss: activeElement.customCss || '',
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
          <h2 className="text-base font-semibold text-card-foreground">
            {t('sidepanel_elements_title', 'Elements')}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t('sidepanel_elements_subtitle', 'Find saved elements across pages.')}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{filteredCount}</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input pl-9"
            type="search"
            placeholder={t('sidepanel_elements_search_placeholder', 'Search by name, type, or page')}
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
                {type === 'all'
                  ? t('sidepanel_elements_type_all', 'All types')
                  : getElementTypeLabel(type)}
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
              {t('sidepanel_action_clear', 'Clear')}
            </button>
          ) : null}
        </div>
      </div>

      {elements.length === 0 ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t('sidepanel_elements_empty', 'No elements yet. Create your first element to get started.')}
        </Card>
      ) : filteredElements.length === 0 ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t('sidepanel_elements_empty_filtered', 'No matches. Try a different search or filter.')}
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
                      {t('sidepanel_action_open', 'Open')}
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
                        <span className="badge-pill shrink-0">{getElementTypeLabel(element.type)}</span>
                        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-card-foreground">
                          {getElementLabel(element)}
                        </h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className={actionClass}
                          aria-label={t('sidepanel_elements_locate', 'Locate element')}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Crosshair className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={`${actionClass} btn-icon-danger`}
                          aria-label={t('sidepanel_elements_delete', 'Delete element')}
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
              <span className="badge-pill shrink-0">
                {getElementTypeLabel(activeElement.type)}
              </span>
              <span>{getElementLabel(activeElement)}</span>
            </>
          ) : (
            t('sidepanel_elements_detail_title', 'Element details')
          )
        }
        description={t('sidepanel_elements_detail_subtitle', 'Update the element settings below.')}
        actions={
          <>
            <button
              type="button"
              className="btn-icon h-8 w-8"
              onClick={() => setActiveElementId(null)}
              aria-label={t('sidepanel_action_cancel', 'Cancel')}
              title={t('sidepanel_action_cancel', 'Cancel')}
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-icon h-8 w-8 border-transparent bg-primary text-primary-foreground hover:brightness-95"
              onClick={handleElementSave}
              aria-label={t('sidepanel_action_save', 'Save')}
              title={t('sidepanel_action_save', 'Save')}
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
            <div className="rounded border border-border bg-card p-3">
              <div className="text-xs font-semibold text-foreground">
                {t('sidepanel_elements_basics', 'Basics')}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 sm:col-span-2">
                  <span>{t('sidepanel_field_name', 'Name')}</span>
                  <input
                    className="input"
                    value={editElement.text}
                    onChange={(event) => setEditElement({ ...editElement, text: event.target.value })}
                    placeholder={t('sidepanel_elements_name_placeholder', 'Element text')}
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-xs sm:col-span-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={editElement.scope === 'site'}
                    onChange={(event) =>
                      setEditElement({ ...editElement, scope: event.target.checked ? 'site' : 'page' })
                    }
                  />
                  <span>{t('sidepanel_elements_apply_site', 'Apply to entire site')}</span>
                </label>
              </div>
            </div>
            <div className="rounded border border-border bg-card p-3">
              <div className="text-xs font-semibold text-foreground">
                {t('sidepanel_elements_action_title', 'Action')}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {editElement.type.toLowerCase() === 'button' ? (
                  <div className="grid gap-1 sm:col-span-2">
                    <span>{t('sidepanel_field_action_flow', 'Action flow')}</span>
                    <SelectMenu
                      value={editElement.actionFlowId || ''}
                      options={actionFlowOptions}
                      useInputStyle={false}
                      buttonClassName={selectButtonClass}
                      onChange={(value) => {
                        if (value === '__create__') {
                          setFlowDrawerOpen(true);
                          return;
                        }
                        setEditElement({ ...editElement, actionFlowId: value });
                      }}
                    />
                  </div>
                ) : null}
                {editElement.type.toLowerCase() === 'link' ? (
                  <>
                    <label className="grid gap-1 sm:col-span-2">
                      <span>{t('sidepanel_elements_link_url', 'Link URL')}</span>
                      <input
                        className="input"
                        value={editElement.href}
                        onChange={(event) => setEditElement({ ...editElement, href: event.target.value })}
                        placeholder={t('sidepanel_elements_link_placeholder', 'https://example.com')}
                      />
                    </label>
                    <div className="grid gap-1 sm:col-span-2">
                      <span>{t('sidepanel_elements_link_target', 'Link target')}</span>
                      <SelectMenu
                        value={editElement.linkTarget || 'new-tab'}
                        options={[
                          { value: 'new-tab', label: t('sidepanel_elements_link_new_tab', 'Open in new tab') },
                          { value: 'same-tab', label: t('sidepanel_elements_link_same_tab', 'Open in same tab') },
                        ]}
                        useInputStyle={false}
                        buttonClassName={selectButtonClass}
                        onChange={(value) =>
                          setEditElement({
                            ...editElement,
                            linkTarget: value === 'same-tab' ? 'same-tab' : 'new-tab',
                          })
                        }
                      />
                    </div>
                  </>
                ) : null}
                {editElement.type.toLowerCase() === 'area' ? (
                  <div className="grid gap-1 sm:col-span-2">
                    <span>{t('sidepanel_field_layout', 'Layout')}</span>
                    <SelectMenu
                      value={editElement.layout || 'row'}
                      options={[
                        { value: 'row', label: t('sidepanel_layout_row', 'Row') },
                        { value: 'column', label: t('sidepanel_layout_column', 'Column') },
                      ]}
                      useInputStyle={false}
                      buttonClassName={selectButtonClass}
                      onChange={(value) =>
                        setEditElement({
                          ...editElement,
                          layout: value === 'column' ? 'column' : 'row',
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded border border-border bg-card p-3">
              <div className="text-xs font-semibold text-foreground">
                {t('sidepanel_elements_styles_title', 'Styles')}
              </div>
              <div className="mt-2 grid gap-3">
                <div className="grid gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('sidepanel_elements_style_preset', 'Preset')}
                  </span>
                  <SelectMenu
                    value={editElement.stylePreset || ''}
                    options={stylePresets.map((preset) => ({
                      value: preset.value,
                      label: preset.label,
                    }))}
                    useInputStyle={false}
                    buttonClassName={selectButtonClass}
                    onChange={(value) => applyStylePreset(value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted p-2 sm:flex-nowrap">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn-ghost h-6 w-6 p-0"
                      aria-label={t('sidepanel_elements_font_decrease', 'Decrease font size')}
                      onClick={() => adjustNumericStyle('fontSize', -1, 'px', 12)}
                    >
                      <AArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost h-6 w-6 p-0"
                      aria-label={t('sidepanel_elements_font_increase', 'Increase font size')}
                      onClick={() => adjustNumericStyle('fontSize', 1, 'px', 12)}
                    >
                      <AArrowUp className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="h-6 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`btn-ghost h-6 w-6 p-0 ${isBold ? 'bg-accent text-accent-foreground' : ''}`}
                      aria-pressed={isBold}
                      onClick={() => applyCustomCssUpdates({ fontWeight: isBold ? '' : '700' })}
                    >
                      <Bold className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={`btn-ghost h-6 w-6 p-0 ${isItalic ? 'bg-accent text-accent-foreground' : ''}`}
                      aria-pressed={isItalic}
                      onClick={() => applyCustomCssUpdates({ fontStyle: isItalic ? '' : 'italic' })}
                    >
                      <Italic className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={`btn-ghost h-6 w-6 p-0 ${isUnderline ? 'bg-accent text-accent-foreground' : ''}`}
                      aria-pressed={isUnderline}
                      onClick={() =>
                        applyCustomCssUpdates({
                          textDecoration: isUnderline ? '' : 'underline',
                        })
                      }
                    >
                      <Underline className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="h-6 w-px bg-border" />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`btn-ghost h-6 w-6 p-0 ${textAlignValue === 'left' ? 'bg-accent text-accent-foreground' : ''}`}
                      aria-pressed={textAlignValue === 'left'}
                      onClick={() => applyCustomCssUpdates({ textAlign: 'left' })}
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={`btn-ghost h-6 w-6 p-0 ${textAlignValue === 'center' ? 'bg-accent text-accent-foreground' : ''}`}
                      aria-pressed={textAlignValue === 'center'}
                      onClick={() => applyCustomCssUpdates({ textAlign: 'center' })}
                    >
                      <AlignCenter className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={`btn-ghost h-6 w-6 p-0 ${textAlignValue === 'right' ? 'bg-accent text-accent-foreground' : ''}`}
                      aria-pressed={textAlignValue === 'right'}
                      onClick={() => applyCustomCssUpdates({ textAlign: 'right' })}
                    >
                      <AlignRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 rounded border border-border bg-muted p-2">
                  <div className="grid gap-2">
                    <div className="grid gap-1">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_style_text', 'Text')}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-7 w-6.5 cursor-pointer rounded-md border border-border p-0"
                          value={resolveColorValue(textColorValue, '#0f172a')}
                          onChange={(event) => applyCustomCssUpdates({ color: event.target.value })}
                        />
                        <span className="h-6 w-px bg-border" />
                        {renderColorSwatches('color')}
                      </div>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_style_background', 'Background')}
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-7 w-6.5 cursor-pointer rounded-md border border-border p-0"
                          value={resolveColorValue(backgroundColorValue, '#ffffff')}
                          onChange={(event) =>
                            applyCustomCssUpdates({ backgroundColor: event.target.value })
                          }
                        />
                        <span className="h-6 w-px bg-border" />
                        {renderColorSwatches('backgroundColor')}
                      </div>
                    </div>
                  </div>
                </div>

                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>{t('sidepanel_field_layout', 'Layout')}</span>
                      <span className="h-px flex-1 bg-border" />
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-border bg-muted p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_style_border', 'Border')}
                      </span>
                      <input
                        className="input h-8 w-40 px-2 text-xs"
                        value={borderValue}
                        onChange={(event) => applyCustomCssUpdates({ border: event.target.value })}
                        placeholder={t('sidepanel_elements_border_placeholder', '1px solid #000')}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_style_radius', 'Radius')}
                      </span>
                      <input
                        className="input h-8 w-16 px-2 text-xs"
                        type="number"
                        value={borderRadiusValue}
                        onChange={(event) =>
                          updateNumericStyle('borderRadius', event.target.value, 'px')
                        }
                        placeholder={t('sidepanel_elements_radius_placeholder', '8')}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_style_shadow', 'Shadow')}
                      </span>
                      <SelectMenu
                        value={shadowOptions.some((option) => option.value === boxShadowValue) ? boxShadowValue : ''}
                        options={shadowOptions}
                        placeholder={t('sidepanel_elements_shadow_custom', 'Custom')}
                        useInputStyle={false}
                        buttonClassName="btn-ghost h-8 px-2 text-xs"
                        onChange={(value) => applyCustomCssUpdates({ boxShadow: value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_style_padding', 'Padding')}
                      </span>
                      <input
                        className="input h-8 w-28 px-2 text-xs"
                        value={paddingValue}
                        onChange={(event) => applyCustomCssUpdates({ padding: event.target.value })}
                        placeholder={t('sidepanel_elements_padding_placeholder', '8px 16px')}
                      />
                    </div>
                  </div>
                </details>

                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>{t('sidepanel_elements_style_position', 'Position')}</span>
                      <span className="h-px flex-1 bg-border" />
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-border bg-muted p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_position_mode', 'Mode')}
                      </span>
                      <SelectMenu
                        value={positionValue}
                        options={positionOptions}
                        placeholder={t('sidepanel_elements_position_auto', 'Auto')}
                        useInputStyle={false}
                        buttonClassName="btn-ghost h-8 px-2 text-xs"
                        onChange={(value) => applyCustomCssUpdates({ position: value })}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_position_width', 'W')}
                      </span>
                      <input
                        className="input h-8 w-16 px-2 text-xs"
                        type="number"
                        value={widthValue}
                        onChange={(event) => updateNumericStyle('width', event.target.value, 'px')}
                        placeholder={t('sidepanel_elements_position_width_placeholder', '120')}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_position_height', 'H')}
                      </span>
                      <input
                        className="input h-8 w-16 px-2 text-xs"
                        type="number"
                        value={heightValue}
                        onChange={(event) => updateNumericStyle('height', event.target.value, 'px')}
                        placeholder={t('sidepanel_elements_position_height_placeholder', '40')}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_position_x', 'X')}
                      </span>
                      <input
                        className="input h-8 w-16 px-2 text-xs"
                        type="number"
                        value={leftValue}
                        onChange={(event) => updateNumericStyle('left', event.target.value, 'px')}
                        placeholder={t('sidepanel_elements_position_x_placeholder', '12')}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_position_y', 'Y')}
                      </span>
                      <input
                        className="input h-8 w-16 px-2 text-xs"
                        type="number"
                        value={topValue}
                        onChange={(event) => updateNumericStyle('top', event.target.value, 'px')}
                        placeholder={t('sidepanel_elements_position_y_placeholder', '12')}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_position_z', 'Z')}
                      </span>
                      <input
                        className="input h-8 w-16 px-2 text-xs"
                        type="number"
                        value={zIndexValue}
                        onChange={(event) => updateNumericStyle('zIndex', event.target.value, '')}
                        placeholder={t('sidepanel_elements_position_z_placeholder', '999')}
                      />
                    </div>
                  </div>
                </details>

                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('sidepanel_elements_custom_styles', 'Custom Styles')}
                  </span>
                  <textarea
                    className="input min-h-[88px] font-mono text-[11px]"
                    rows={3}
                    value={editElement.customCss || ''}
                    onChange={(event) =>
                      setEditElement({
                        ...editElement,
                        customCss: event.target.value,
                      })
                    }
                    placeholder={t('sidepanel_elements_custom_styles_placeholder', 'color: #0f172a; padding: 8px;')}
                  />
                </label>
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>

      <FlowDrawer
        open={flowDrawerOpen}
        title={t('sidepanel_flows_new_title', 'New flow')}
        subtitle={t('sidepanel_flows_new_subtitle', 'Create a new action flow.')}
        onClose={() => setFlowDrawerOpen(false)}
        summary={renderFlowSummary(getFlowStepCount(draftFlow.steps), handleCreateFlow)}
        overlayClassName="z-[70]"
        panelClassName="z-[80]"
      >
        <div className="space-y-4 text-xs text-muted-foreground">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t('sidepanel_field_name', 'Name')}
            <input
              className="input mt-1"
              value={draftFlow.name}
              onChange={(event) => setDraftFlow({ ...draftFlow, name: event.target.value })}
              placeholder={t('sidepanel_flows_name_placeholder', 'Flow name')}
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            {t('sidepanel_field_description', 'Description')}
            <textarea
              className="input mt-1"
              rows={2}
              value={draftFlow.description}
              onChange={(event) => setDraftFlow({ ...draftFlow, description: event.target.value })}
              placeholder={t('sidepanel_flows_description_prompt', 'What does this flow do?')}
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            {t('sidepanel_steps_title', 'Steps')}
            <input
              className="input mt-1"
              type="number"
              min="0"
              value={draftFlow.steps}
              onChange={(event) =>
                setDraftFlow({ ...draftFlow, steps: Number(event.target.value) || 0 })
              }
            />
          </label>
          <FlowStepsBuilder />
        </div>
      </FlowDrawer>
    </div>
  );
}
