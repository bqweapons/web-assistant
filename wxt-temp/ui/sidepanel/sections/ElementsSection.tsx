import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  RefreshCw,
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
import { mockFlows } from '../utils/mockData';
import { t, useLocale } from '../utils/i18n';
import {
  MessageType,
  type ElementPayload,
  type PickerRect,
  type RuntimeMessage,
  type SelectorPickerAccept,
} from '../../../shared/messages';
import { getSiteData, setSiteData } from '../../../shared/storage';

type ElementInlineStyle = Record<string, string>;
type ElementStyle = {
  preset?: string;
  inline?: ElementInlineStyle;
  customCss?: string;
};

type ElementRecord = ElementPayload & {
  text: string;
  selector: string;
  position: NonNullable<ElementPayload['position']>;
  style: ElementStyle;
  pageUrl: string;
  siteUrl: string;
  frameUrl: string;
  frameSelectors: string[];
  floating: boolean;
  createdAt: number;
  updatedAt: number;
  actionFlowId?: string;
  actionFlowLocked?: boolean;
  actionFlow?: string;
};

type BaseElement = Partial<ElementRecord> & {
  id?: string;
  type?: string;
  position?: string;
  style?: unknown;
  stylePreset?: string;
  customCss?: string;
};

const isElementType = (value: unknown): value is ElementPayload['type'] =>
  value === 'button' || value === 'link' || value === 'tooltip' || value === 'area';

const isElementPosition = (value: unknown): value is NonNullable<ElementPayload['position']> =>
  value === 'append' || value === 'prepend' || value === 'before' || value === 'after';

const normalizeElementPosition = (value: unknown): NonNullable<ElementPayload['position']> =>
  isElementPosition(value) ? value : 'append';

const normalizeElementScope = (value: unknown): NonNullable<ElementPayload['scope']> =>
  value === 'site' || value === 'global' ? value : 'page';

const isStyleRecord = (value: unknown): value is Record<string, string> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const normalizeStyle = (
  rawStyle: unknown,
  legacyPreset?: string,
  legacyCustomCss?: string,
): ElementStyle => {
  if (isStyleRecord(rawStyle) && ('inline' in rawStyle || 'preset' in rawStyle || 'customCss' in rawStyle)) {
    const typed = rawStyle as ElementStyle;
    return {
      preset: typeof typed.preset === 'string' ? typed.preset : legacyPreset,
      inline: isStyleRecord(typed.inline) ? typed.inline : {},
      customCss: typeof typed.customCss === 'string' ? typed.customCss : legacyCustomCss || '',
    };
  }
  return {
    preset: legacyPreset,
    inline: isStyleRecord(rawStyle) ? rawStyle : {},
    customCss: legacyCustomCss || '',
  };
};

const normalizeElement = (element: BaseElement): ElementRecord | null => {
  if (!element?.id || typeof element.id !== 'string' || !isElementType(element.type)) {
    return null;
  }
  const { style, stylePreset, customCss, ...rest } = element as BaseElement & {
    stylePreset?: string;
    customCss?: string;
  };
  return {
    ...rest,
    id: element.id,
    type: element.type,
    text: typeof element.text === 'string' ? element.text : '',
    selector: typeof element.selector === 'string' ? element.selector : '',
    position: normalizeElementPosition(element.position),
    pageUrl: typeof element.pageUrl === 'string' ? element.pageUrl : '',
    siteUrl: typeof element.siteUrl === 'string' ? element.siteUrl : '',
    frameUrl: typeof element.frameUrl === 'string' ? element.frameUrl : '',
    frameSelectors: Array.isArray(element.frameSelectors)
      ? element.frameSelectors.filter((item): item is string => typeof item === 'string')
      : [],
    floating: element.floating !== false,
    scope: normalizeElementScope(element.scope),
    createdAt: typeof element.createdAt === 'number' ? element.createdAt : Date.now(),
    updatedAt: typeof element.updatedAt === 'number' ? element.updatedAt : Date.now(),
    style: normalizeStyle(style, stylePreset, customCss),
  };
};

const toElementPayload = (element: ElementRecord): ElementPayload => ({
  id: element.id,
  type: element.type,
  text: element.text,
  selector: element.selector,
  position: normalizeElementPosition(element.position),
  beforeSelector: element.beforeSelector,
  afterSelector: element.afterSelector,
  containerId: element.containerId,
  floating: element.floating,
  layout: element.layout,
  href: element.href,
  linkTarget: element.linkTarget,
  tooltipPosition: element.tooltipPosition,
  tooltipPersistent: element.tooltipPersistent,
  style: {
    preset: element.style?.preset,
    inline: element.style?.inline || {},
    customCss: element.style?.customCss || '',
  },
  scope: element.scope,
  siteUrl: element.siteUrl,
  pageUrl: element.pageUrl,
  frameUrl: element.frameUrl,
  frameSelectors: element.frameSelectors,
  createdAt: element.createdAt,
  updatedAt: element.updatedAt,
});

const normalizeSiteKey = (value: string) =>
  value.replace(/^https?:\/\//, '').replace(/^file:\/\//, '').replace(/\/$/, '');

const normalizePageKey = (value?: string) => {
  if (!value) {
    return '';
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'file:') {
      return `${normalizeSiteKey(value.split(/[?#]/)[0] || value)}`;
    }
    const siteKey = normalizeSiteKey(parsed.host || parsed.hostname || value);
    const path = parsed.pathname || '/';
    return `${siteKey}${path.startsWith('/') ? path : `/${path}`}`;
  } catch {
    if (value.startsWith('/')) {
      return value;
    }
    return normalizeSiteKey(value);
  }
};

type ElementsSectionProps = {
  siteKey?: string;
  pageKey?: string;
  pageUrl?: string;
  hasActivePage?: boolean;
  isSyncing?: boolean;
  lastSyncedAt?: number;
  onRefresh?: () => void;
  onStartPicker?: (accept: SelectorPickerAccept) => Promise<string | null>;
  onStartAreaPicker?: () => Promise<PickerRect | null>;
  onStartElementPicker?: (options?: { disallowInput?: boolean }) => Promise<{
    selector: string;
    beforeSelector?: string;
    afterSelector?: string;
    containerId?: string;
  } | null>;
};

export default function ElementsSection({
  siteKey,
  pageKey,
  pageUrl,
  hasActivePage = false,
  isSyncing = false,
  lastSyncedAt,
  onRefresh,
  onStartPicker,
  onStartAreaPicker,
  onStartElementPicker,
}: ElementsSectionProps) {
  const locale = useLocale();
  const [elements, setElements] = useState<ElementRecord[]>([]);
  const [flows, setFlows] = useState(mockFlows);
  const actionClass = 'btn-icon h-8 w-8';
  const selectButtonClass = 'btn-ghost h-9 w-full justify-between px-2 text-xs';
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [draftElementId, setDraftElementId] = useState<string | null>(null);
  const [addElementType, setAddElementType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const normalizedSiteKey = useMemo(() => normalizeSiteKey(siteKey || ''), [siteKey]);
  const siteElements = useMemo(() => {
    if (!normalizedSiteKey) {
      return [];
    }
    return elements.filter(
      (element) => normalizeSiteKey(element.siteUrl || '') === normalizedSiteKey,
    );
  }, [elements, normalizedSiteKey]);
  const currentSite = siteKey || siteElements[0]?.siteUrl || 'site';
  const activeElement = siteElements.find((element) => element.id === activeElementId) ?? null;
  const [editElement, setEditElement] = useState<ElementRecord | null>(activeElement);
  const [flowDrawerOpen, setFlowDrawerOpen] = useState(false);
  const [draftFlow, setDraftFlow] = useState({
    name: '',
    description: '',
    steps: 0,
  });
  useEffect(() => {
    setActiveElementId(null);
    setDraftElementId(null);
    setSearchQuery('');
    setTypeFilter('all');
  }, [normalizedSiteKey]);

  useEffect(() => {
    if (!normalizedSiteKey) {
      setElements([]);
      setFlows(mockFlows);
      return;
    }
    getSiteData(normalizedSiteKey)
      .then((data) => {
        const normalized =
          (data.elements as BaseElement[] | undefined)
            ?.map((item) => normalizeElement(item))
            .filter((item): item is ElementRecord => Boolean(item)) || [];
        setElements(normalized);
        setFlows((data.flows as typeof mockFlows | undefined) || mockFlows);
      })
      .catch(() => {
        setElements([]);
        setFlows(mockFlows);
      });
  }, [normalizedSiteKey]);
  const typeOptions = useMemo(() => {
    const types = new Set(siteElements.map((element) => element.type));
    return ['all', ...Array.from(types).sort()];
  }, [siteElements]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredElements = useMemo(() => {
    return siteElements.filter((element) => {
      if (typeFilter !== 'all' && element.type !== typeFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = `${element.text} ${element.type} ${element.pageUrl} ${element.selector} ${element.href || ''}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [siteElements, normalizedQuery, typeFilter]);
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
  const totalCount = siteElements.length;
  const filteredCount = filteredElements.length;
  const showClear = Boolean(searchQuery) || typeFilter !== 'all';
  const creationDisabled = !hasActivePage || !normalizedSiteKey;
  const [injectionError, setInjectionError] = useState('');
  const previewTimerRef = useRef<number | null>(null);
  const suppressPreviewElementIdRef = useRef<string | null>(null);
  const getInjectionErrorMessage = (code: string) => {
    const normalized = code.trim().toLowerCase();
    if (
      normalized === 'content-unavailable' ||
      normalized.includes('receiving end does not exist') ||
      normalized.includes('could not establish connection')
    ) {
      return t(
        'sidepanel_elements_injection_error_content',
        'Cannot connect to the page script. Reload the page and try again.',
      );
    }
    if (normalized === 'site-mismatch') {
      return t('sidepanel_elements_injection_error_site', 'Current page does not match element site.');
    }
    if (normalized === 'container-not-found') {
      return t('sidepanel_elements_injection_error_container', 'Container not found on page.');
    }
    if (normalized === 'target-not-found') {
      return t('sidepanel_elements_injection_error_target', 'Target element not found.');
    }
    return t('sidepanel_elements_injection_error', 'Failed to inject element: {error}').replace(
      '{error}',
      code,
    );
  };
  const sendRuntimeMessage = useCallback((message: unknown) => {
    return new Promise<unknown>((resolve, reject) => {
      const runtime = chrome?.runtime;
      if (!runtime?.sendMessage) {
        reject(new Error('Messaging API unavailable.'));
        return;
      }
      runtime.sendMessage(message, (response) => {
        const lastError = runtime.lastError?.message;
        if (lastError) {
          reject(new Error(lastError));
          return;
        }
        resolve(response);
      });
    });
  }, []);

  const sendElementMessage = useCallback(
    async (type: MessageType, payload?: Record<string, unknown>) => {
      try {
        const response = (await sendRuntimeMessage({ type, data: payload })) as { ok?: boolean; error?: string };
        if (response?.ok === false && response.error) {
          throw new Error(response.error);
        }
      } catch (error) {
        console.warn('Failed to send element message', type, error);
        throw error;
      }
    },
    [sendRuntimeMessage],
  );

  const syncElementsToContent = useCallback(() => {
    if (!hasActivePage || !normalizedSiteKey) {
      return;
    }
    const currentPageKey = normalizePageKey(pageUrl || pageKey);
    const payload: ElementPayload[] = siteElements.map((element) => toElementPayload(element)).filter((element) => {
      if (element.scope !== 'page') {
        return true;
      }
      if (!element.pageUrl) {
        return true;
      }
      return normalizePageKey(element.pageUrl) === currentPageKey;
    });
    sendElementMessage(MessageType.REHYDRATE_ELEMENTS, { elements: payload })
      .then(() => setInjectionError(''))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setInjectionError(message);
      });
  }, [hasActivePage, normalizedSiteKey, pageUrl, pageKey, sendElementMessage, siteElements]);

  const persistSiteData = useCallback(
    async (nextElements: ElementRecord[], nextFlows: typeof flows) => {
      if (!normalizedSiteKey) {
        return;
      }
      await setSiteData(normalizedSiteKey, {
        elements: nextElements,
        flows: nextFlows,
      });
    },
    [normalizedSiteKey],
  );

  useEffect(() => {
    const runtime = chrome?.runtime;
    if (!runtime?.onMessage) {
      return;
    }
    const handleRuntimeMessage = (rawMessage: RuntimeMessage) => {
      if (!rawMessage?.forwarded || rawMessage.type !== MessageType.ELEMENT_DRAFT_UPDATED) {
        return;
      }
      const normalized = normalizeElement((rawMessage.data?.element || null) as BaseElement);
      if (!normalized) {
        return;
      }
      if (normalizeSiteKey(normalized.siteUrl || '') !== normalizedSiteKey) {
        return;
      }
      setElements((prev) => {
        const index = prev.findIndex((item) => item.id === normalized.id);
        if (index === -1) {
          return prev;
        }
        const next = prev.slice();
        next[index] = normalized;
        if (normalized.id !== draftElementId) {
          persistSiteData(next, flows).catch(() => undefined);
        }
        return next;
      });
      setEditElement((prev) => (prev?.id === normalized.id ? { ...prev, ...normalized } : prev));
      setInjectionError('');
    };
    runtime.onMessage.addListener(handleRuntimeMessage);
    return () => runtime.onMessage.removeListener(handleRuntimeMessage);
  }, [draftElementId, flows, normalizedSiteKey, persistSiteData]);

  useEffect(() => {
    if (!hasActivePage || !normalizedSiteKey) {
      sendElementMessage(MessageType.SET_EDITING_ELEMENT, { id: undefined }).catch(() => undefined);
      return;
    }
    sendElementMessage(MessageType.SET_EDITING_ELEMENT, { id: activeElement?.id })
      .then(() => setInjectionError(''))
      .catch((error) => setInjectionError(error instanceof Error ? error.message : String(error)));
  }, [activeElement?.id, hasActivePage, normalizedSiteKey, sendElementMessage]);

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
    return siteElements.reduce<Record<string, number>>((acc, element) => {
      if (element.containerId) {
        acc[element.containerId] = (acc[element.containerId] ?? 0) + 1;
      }
      return acc;
    }, {});
  }, [siteElements]);
  const flowSiteKey = useMemo(
    () => normalizeSiteKey(editElement?.siteUrl || activeElement?.siteUrl || siteKey || ''),
    [editElement?.siteUrl, activeElement?.siteUrl, siteKey],
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
  const placementOptions = [
    { value: 'append', label: t('sidepanel_elements_place_append', 'Append inside target') },
    { value: 'prepend', label: t('sidepanel_elements_place_prepend', 'Prepend inside target') },
    { value: 'before', label: t('sidepanel_elements_place_before', 'Insert before target') },
    { value: 'after', label: t('sidepanel_elements_place_after', 'Insert after target') },
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
    if (normalized === 'tooltip') {
      return t('sidepanel_element_type_tooltip', 'Tooltip');
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
  const getPagePathLabel = (pageUrl: string, siteUrl: string) => {
    try {
      const href = getPageHref(pageUrl, siteUrl);
      const parsed = new URL(href);
      const path = parsed.pathname || '/';
      return path || '/';
    } catch {
      if (pageUrl.startsWith('/')) {
        return pageUrl || '/';
      }
      const [, ...rest] = pageUrl.split('/');
      return rest.length ? `/${rest.join('/')}` : '/';
    }
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
    const nextInline = preset?.styles ? { ...preset.styles } : {};
    const nextCustomCss = preset?.styles ? formatCustomCss(preset.styles) : '';
    setEditElement({
      ...editElement,
      style: {
        preset: presetValue,
        inline: nextInline,
        customCss: nextCustomCss,
      },
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
    () => (editElement?.style?.customCss ? parseCustomCss(editElement.style.customCss) : {}),
    [editElement?.style?.customCss],
  );

  const applyCustomCssUpdates = (updates: Record<string, string | undefined>) => {
    if (!editElement) {
      return;
    }
    const currentCustom = parseCustomCss(editElement.style?.customCss || '');
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
    const nextInline = { ...(editElement.style?.inline || {}) };
    Object.entries(updates).forEach(([key, value]) => {
      const nextValue = value?.trim();
      if (nextValue) {
        nextInline[key] = nextValue;
      } else {
        delete nextInline[key];
      }
    });
    setEditElement({
      ...editElement,
      style: {
        preset: detectStylePreset(nextInline),
        inline: nextInline,
        customCss: nextCustomCss,
      },
    });
  };

  const applyCustomCssText = (raw: string) => {
    if (!editElement) {
      return;
    }
    const parsed = parseCustomCss(raw);
    setEditElement({
      ...editElement,
      style: {
        preset: detectStylePreset(parsed),
        inline: parsed,
        customCss: raw,
      },
    });
  };

  const getStyleValue = (key: string) => {
    if (customStyleOverrides[key] !== undefined) {
      return customStyleOverrides[key];
    }
    return editElement?.style?.inline?.[key] || '';
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
      suppressPreviewElementIdRef.current = null;
      return;
    }
    suppressPreviewElementIdRef.current = null;
    const resolvedInline = activeElement.style?.inline || {};
    const resolvedCustomCss = activeElement.style?.customCss || '';
    const resolvedPreset =
      activeElement.style?.preset || detectStylePreset(resolvedInline);
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
      style: {
        preset: resolvedPreset,
        inline: resolvedInline,
        customCss: resolvedCustomCss,
      },
    });
  }, [activeElement]);

  useEffect(() => {
    if (!flowDrawerOpen) {
      return;
    }
    setDraftFlow({ name: '', description: '', steps: 0 });
  }, [flowDrawerOpen]);

  useEffect(() => {
    syncElementsToContent();
  }, [syncElementsToContent]);

  const createElementId = () =>
    `element-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const defaultSiteUrl =
    siteElements[0]?.siteUrl || (siteKey ? `https://${siteKey}` : 'https://example.com');
  const defaultPageUrl =
    pageUrl ||
    (pageKey
      ? pageKey.startsWith('http://') || pageKey.startsWith('https://') || pageKey.startsWith('file://')
        ? pageKey
        : `https://${pageKey}`
      : '') ||
    siteElements[0]?.pageUrl ||
    defaultSiteUrl;
  const defaultFrameUrl = siteElements[0]?.frameUrl || defaultPageUrl;

  const handleAddElementType = async (value: string) => {
    setAddElementType(value);
    if (!value) {
      return;
    }
    if (!hasActivePage || !normalizedSiteKey) {
      setAddElementType('');
      return;
    }
    if (value === 'area') {
      if (!onStartAreaPicker) {
        setAddElementType('');
        return;
      }
      const rect = await onStartAreaPicker();
      if (!rect) {
        setAddElementType('');
        return;
      }
      const now = Date.now();
      const areaInline: ElementInlineStyle = {
        backgroundColor: '#f59e0b30',
        borderRadius: '14px',
        color: '#0f172a',
        height: `${Math.max(1, Math.round(rect.height))}px`,
        left: `${Math.round(rect.x)}px`,
        position: 'absolute',
        top: `${Math.round(rect.y)}px`,
        width: `${Math.max(1, Math.round(rect.width))}px`,
        zIndex: '2147482000',
      };
      const newArea: ElementRecord = {
        id: createElementId(),
        type: 'area' as const,
        text: t('sidepanel_elements_add_area', 'Area'),
        selector: 'body',
        position: 'append',
        layout: 'row' as const,
        style: {
          preset: detectStylePreset(areaInline),
          inline: areaInline,
          customCss: formatCustomCss(areaInline),
        },
        pageUrl: defaultPageUrl,
        siteUrl: defaultSiteUrl,
        frameUrl: defaultFrameUrl,
        frameSelectors: [] as string[],
        floating: true,
        createdAt: now,
        updatedAt: now,
      };
      setElements((prev) => {
        const next = [newArea, ...prev];
        return next;
      });
      sendElementMessage(MessageType.CREATE_ELEMENT, { element: toElementPayload(newArea) })
        .then(() => {
          setInjectionError('');
          syncElementsToContent();
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          setInjectionError(message);
        });
      setActiveElementId(newArea.id);
      setDraftElementId(newArea.id);
      setAddElementType('');
      return;
    }
    if (!onStartElementPicker && !onStartPicker) {
      setAddElementType('');
      return;
    }
    const normalizedType: 'tooltip' | 'button' | 'link' =
      value === 'tooltip' ? 'tooltip' : value === 'link' ? 'link' : 'button';
    let selectorPayload: {
      selector: string;
      beforeSelector?: string;
      afterSelector?: string;
      containerId?: string;
    } | null = null;
    if (onStartElementPicker) {
      selectorPayload = await onStartElementPicker({
        disallowInput: normalizedType === 'button' || normalizedType === 'link',
      });
    } else if (onStartPicker) {
      const selector = await onStartPicker('selector');
      selectorPayload = selector ? { selector } : null;
    }
    if (!selectorPayload?.selector) {
      setAddElementType('');
      return;
    }
    const { selector, beforeSelector, afterSelector, containerId } = selectorPayload;
    const attachToArea = Boolean(containerId);
    const now = Date.now();
    const elementInline: ElementInlineStyle =
      normalizedType === 'tooltip'
        ? {
            backgroundColor: '#0f172a',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: '600',
            padding: '6px 10px',
          }
        : normalizedType === 'link'
          ? {
              color: '#2563eb',
              textDecoration: 'underline',
            }
          : {
              backgroundColor: '#1b84ff',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '600',
              padding: '8px 16px',
            };
    const newElement: ElementRecord = {
      id: createElementId(),
      type: normalizedType,
      text:
        normalizedType === 'tooltip'
          ? t('sidepanel_elements_add_tooltip', 'Tooltip')
          : normalizedType === 'link'
            ? t('sidepanel_elements_add_link', 'Link')
          : t('sidepanel_elements_add_button', 'Button'),
      selector,
      beforeSelector: attachToArea ? undefined : beforeSelector,
      afterSelector: attachToArea ? undefined : afterSelector,
      containerId: attachToArea ? containerId : undefined,
      position:
        attachToArea
          ? 'append'
          : selectorPayload.beforeSelector || selectorPayload.afterSelector
          ? selectorPayload.beforeSelector
            ? 'before'
            : 'after'
          : normalizedType === 'tooltip'
            ? 'after'
            : 'append',
      style: {
        preset: detectStylePreset(elementInline),
        inline: elementInline,
        customCss: formatCustomCss(elementInline),
      },
      pageUrl: defaultPageUrl,
      siteUrl: defaultSiteUrl,
      frameUrl: defaultFrameUrl,
      frameSelectors: [] as string[],
      floating: false,
      scope: 'page',
      createdAt: now,
      updatedAt: now,
      tooltipPosition: normalizedType === 'tooltip' ? ('top' as const) : undefined,
      tooltipPersistent: normalizedType === 'tooltip' ? false : undefined,
      href: normalizedType === 'link' ? 'https://example.com' : undefined,
      linkTarget: normalizedType === 'link' ? ('new-tab' as const) : undefined,
    };
    setElements((prev) => {
      const next = [newElement, ...prev];
      return next;
    });
    sendElementMessage(MessageType.CREATE_ELEMENT, { element: toElementPayload(newElement) })
      .then(() => {
        setInjectionError('');
        syncElementsToContent();
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setInjectionError(message);
    });
    setActiveElementId(newElement.id);
    setDraftElementId(newElement.id);
    setAddElementType('');
  };

  const handleSelectElement = (id: string) => {
    setActiveElementId(id);
    sendElementMessage(MessageType.FOCUS_ELEMENT, { id }).catch((error) =>
      setInjectionError(error instanceof Error ? error.message : String(error)),
    );
  };

  const handleElementSave = () => {
    if (!editElement) {
      return;
    }
    setElements((prev) => {
      const next = prev.map((item) => (item.id === editElement.id ? { ...item, ...editElement } : item));
      persistSiteData(next, flows).catch(() => undefined);
      return next;
    });
    sendElementMessage(MessageType.UPDATE_ELEMENT, { element: toElementPayload(editElement) })
      .then(() => {
        setInjectionError('');
        syncElementsToContent();
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setInjectionError(message);
      });
    setDraftElementId((prev) => (prev === editElement.id ? null : prev));
    setActiveElementId(null);
  };

  const handleDeleteElement = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    const targetElement = siteElements.find((item) => item.id === id) || null;
    const targetLabel = targetElement ? getElementLabel(targetElement) : t('sidepanel_elements_delete', 'Delete element');
    const confirmMessage = t(
      'sidepanel_elements_delete_confirm',
      'Delete "{name}"? This action cannot be undone.',
    ).replace('{name}', targetLabel);
    if (!window.confirm(confirmMessage)) {
      return;
    }
    if (activeElementId === id) {
      setActiveElementId(null);
    }
    if (draftElementId === id) {
      setDraftElementId(null);
    }
    setElements((prev) => {
      const next = prev.filter((item) => item.id !== id);
      persistSiteData(next, flows).catch(() => undefined);
      return next;
    });
    sendElementMessage(MessageType.DELETE_ELEMENT, { id })
      .then(() => {
        setInjectionError('');
        syncElementsToContent();
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setInjectionError(message);
      });
  };

  const handleFocusElement = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    sendElementMessage(MessageType.FOCUS_ELEMENT, { id }).catch((error) =>
      setInjectionError(error instanceof Error ? error.message : String(error)),
    );
  };

  const handlePickSelector = async () => {
    if (!onStartElementPicker && !onStartPicker) {
      return;
    }
    let result: {
      selector: string;
      beforeSelector?: string;
      afterSelector?: string;
      containerId?: string;
    } | null = null;
    if (onStartElementPicker) {
      result = await onStartElementPicker({
        disallowInput: editElement?.type === 'button' || editElement?.type === 'link',
      });
    } else if (onStartPicker) {
      const selector = await onStartPicker('selector');
      result = selector ? { selector } : null;
    }
    if (!result?.selector || !editElement) {
      return;
    }
    const attachToArea = Boolean(result.containerId);
    setEditElement({
      ...editElement,
      selector: result.selector,
      beforeSelector: attachToArea ? '' : result.beforeSelector || '',
      afterSelector: attachToArea ? '' : result.afterSelector || '',
      containerId: attachToArea ? result.containerId : undefined,
      position:
        attachToArea
          ? 'append'
          : result.beforeSelector
            ? 'before'
            : result.afterSelector
              ? 'after'
              : editElement.position,
    });
    setInjectionError('');
  };

  const closeDetails = useCallback(() => {
    setInjectionError('');
    const closingId = activeElementId;
    const isDraft = Boolean(closingId && draftElementId && closingId === draftElementId);
    if (previewTimerRef.current != null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (closingId) {
      suppressPreviewElementIdRef.current = closingId;
    }
    setEditElement(null);
    if (closingId && isDraft) {
      setElements((prev) => {
        const next = prev.filter((item) => item.id !== closingId);
        persistSiteData(next, flows).catch(() => undefined);
        return next;
      });
      sendElementMessage(MessageType.DELETE_ELEMENT, { id: closingId })
        .then(() => {
          setInjectionError('');
          syncElementsToContent();
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          setInjectionError(message);
        });
      setDraftElementId(null);
    } else {
      syncElementsToContent();
    }
    setActiveElementId(null);
  }, [
    activeElementId,
    draftElementId,
    flows,
    persistSiteData,
    previewTimerRef,
    sendElementMessage,
    syncElementsToContent,
  ]);

  useEffect(() => {
    if (!editElement || !activeElement) {
      return;
    }
    if (suppressPreviewElementIdRef.current === editElement.id) {
      return;
    }
    if (previewTimerRef.current != null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    const handle = window.setTimeout(() => {
      sendElementMessage(MessageType.PREVIEW_ELEMENT, { element: toElementPayload(editElement) }).catch((error) =>
        setInjectionError(error instanceof Error ? error.message : String(error)),
      );
      if (previewTimerRef.current === handle) {
        previewTimerRef.current = null;
      }
    }, 150);
    previewTimerRef.current = handle;
    return () => {
      window.clearTimeout(handle);
      if (previewTimerRef.current === handle) {
        previewTimerRef.current = null;
      }
    };
  }, [activeElement, editElement, sendElementMessage]);

  const renderElementCard = (element: ElementRecord) => (
    <Card
      key={element.id}
      className="p-4"
      onClick={() => handleSelectElement(element.id)}
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
            onClick={(event) => handleFocusElement(event, element.id)}
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`${actionClass} btn-icon-danger`}
            aria-label={t('sidepanel_elements_delete', 'Delete element')}
            onClick={(event) => handleDeleteElement(event, element.id)}
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
  );

  return (
    <div className="flex flex-col gap-2">
      {injectionError ? (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {getInjectionErrorMessage(injectionError)}
        </div>
      ) : null}
      <SelectMenu
        disabled={creationDisabled}
        value={addElementType}
        placeholder={t('sidepanel_elements_add_placeholder', 'Add element to page')}
        iconPosition="right"
        useInputStyle={false}
        buttonClassName="btn-primary w-full"
        centerLabel
        options={[
          {
            value: 'area',
            label: t('sidepanel_elements_add_area', 'Area'),
            rightLabel: t('sidepanel_elements_add_area_hint', 'Select a region'),
          },
          {
            value: 'button',
            label: t('sidepanel_elements_add_button', 'Button'),
            rightLabel: t('sidepanel_elements_add_button_hint', 'Insert a clickable button'),
          },
          {
            value: 'link',
            label: t('sidepanel_elements_add_link', 'Link'),
            rightLabel: t('sidepanel_elements_add_link_hint', 'Insert a clickable link'),
          },
        ]}
        onChange={handleAddElementType}
      />
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
            disabled={creationDisabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input select w-full sm:w-40"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            disabled={creationDisabled}
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

      {creationDisabled ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t(
            'sidepanel_elements_no_active_page',
            'No active page detected. Open a site tab and refresh to manage elements.',
          )}
        </Card>
      ) : siteElements.length === 0 ? (
        <Card className="bg-muted text-center text-sm text-muted-foreground">
          {t('sidepanel_elements_empty_site', 'No elements for this site yet. Add one to get started.')}
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
                  <p
                    className="max-w-[220px] truncate text-sm font-semibold text-card-foreground"
                    title={getPageLabel(page, pageSite)}
                  >
                    {getPagePathLabel(page, pageSite)}
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
                {(() => {
                  const areaGroups = pageElements
                    .filter((element) => element.type === 'area')
                    .map((area) => ({
                      area,
                      children: pageElements.filter(
                        (element) => element.id !== area.id && element.containerId === area.id,
                      ),
                    }));
                  const groupedChildIds = new Set(
                    areaGroups.flatMap((group) => group.children.map((child) => child.id)),
                  );
                  const ungroupedElements = pageElements.filter(
                    (element) => element.type !== 'area' && !groupedChildIds.has(element.id),
                  );

                  return (
                    <>
                      {areaGroups.map((group) => (
                        <div key={group.area.id} className="grid gap-2 rounded border border-border/70 p-2">
                          {renderElementCard(group.area)}
                          {group.children.length > 0 ? (
                            <div className="ml-3 grid gap-2 border-l border-border pl-3">
                              {group.children.map((element) => renderElementCard(element))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {ungroupedElements.length > 0 ? (
                        <div className="grid gap-2">
                          <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {t('sidepanel_elements_group_ungrouped', 'Ungrouped')}
                          </div>
                          {ungroupedElements.map((element) => renderElementCard(element))}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
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
              onClick={closeDetails}
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
  onClose={closeDetails}
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
                      useInputStyle
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
                    value={editElement.style?.preset || ''}
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
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-border p-2">
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
                        useInputStyle
                        buttonClassName="h-8 w-28 px-2 text-xs"
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
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-border p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {t('sidepanel_elements_position_mode', 'Mode')}
                      </span>
                      <SelectMenu
                        value={positionValue}
                        options={positionOptions}
                        placeholder={t('sidepanel_elements_position_auto', 'Auto')}
                        useInputStyle
                        buttonClassName="h-8 w-24 px-2 text-xs"
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
                    value={editElement.style?.customCss || ''}
                    onChange={(event) => applyCustomCssText(event.target.value)}
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
          <FlowStepsBuilder onStartPicker={onStartPicker} />
        </div>
      </FlowDrawer>
    </div>
  );
}
