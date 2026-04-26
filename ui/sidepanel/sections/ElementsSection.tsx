import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  Check,
  ExternalLink,
  Play,
  RefreshCw,
  Link as LinkIcon,
  Search,
  Square,
  X,
} from 'lucide-react';
import Card from '../components/Card';
import Drawer from '../components/Drawer';
import FlowDrawer from '../components/FlowDrawer';
import ConfirmDialog from '../components/ConfirmDialog';
import FlowStepsBuilder from '../components/FlowStepsBuilder';
import SelectMenu from '../components/SelectMenu';
import { t, useLocale } from '../utils/i18n';
import { formatLocalDateTime } from '../utils/dateTime';
import {
  type FlowRecordingEventPayload,
  MessageType,
  type PickerRect,
  type RuntimeMessage,
  type SelectorPickerAccept,
} from '../../../shared/messages';
import {
  buildDefaultSiteUrl,
  deriveSiteKey,
} from '../../../shared/siteDataSchema';
import type { FlowStepData } from '../../../shared/flowStepMigration';
import {
  getElementHref,
  getElementLayout,
  getElementPosition,
  getElementScope,
  getElementSelector,
  getElementType,
  isElementType,
  normalizeElementPosition,
  normalizeElementScope,
  normalizePageKey,
  normalizeSiteKey,
  normalizeStoredElement,
  resolveElementContext,
  resolveStructuredPageUrl,
  toMessageElementPayload,
  type ElementInlineStyle,
  type ElementRecord,
  type StoredElementRecord,
} from './elements/normalize';
import { getInjectionErrorMessage, sendElementMessage as sendElementMessageShared } from './elements/useElementsMessaging';
import { useElementsStore } from './elements/useElementsStore';
import {
  detectStylePreset as detectStylePresetFn,
  formatCustomCss as formatCustomCssFn,
  getNumericValue,
  parseCustomCss,
  resolveColorValue as resolveColorValueFn,
  type StylePreset,
} from './elements/styleUtils';
import { getPageHref, getPageLabel as getPageLabelFn, getPagePathLabel } from './elements/pageUrlFormat';
import ElementStyleEditor from './elements/ElementStyleEditor';
import ElementBasicsAction from './elements/ElementBasicsAction';
import ElementCard from './elements/ElementCard';
import { useElementsWriteQueue } from '../hooks/useElementsWriteQueue';
import { getStepCount } from './flows/normalize';
import { appendRecordedEventToSteps } from './flows/recording';
import { useFlowRecording } from './flows/useFlowRecording';

type ElementsSectionProps = {
  siteKey?: string;
  pageKey?: string;
  pageUrl?: string;
  tabId?: number;
  hasActivePage?: boolean;
  isSyncing?: boolean;
  lastSyncedAt?: number;
  onRefresh?: () => void;
  onStartPicker?: (accept: SelectorPickerAccept) => Promise<string | null>;
  // F1 — Frame-aware picker for the embedded FlowStepsBuilder (elements
  // with attached flows). Distinct from `onStartPicker` so the element's
  // own selector fields keep the string-only shape while flow step
  // editing inside this section can capture iframe metadata.
  onStartFlowPicker?: (
    accept: SelectorPickerAccept,
  ) => Promise<{ selector: string; frameUrl?: string } | null>;
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
  tabId,
  hasActivePage = false,
  isSyncing = false,
  lastSyncedAt,
  onRefresh,
  onStartPicker,
  onStartFlowPicker,
  onStartAreaPicker,
  onStartElementPicker,
}: ElementsSectionProps) {
  const locale = useLocale();
  const normalizedSiteKey = useMemo(() => normalizeSiteKey(siteKey || ''), [siteKey]);
  const {
    elements,
    setElements,
    flows,
    setFlows,
    status: siteDataStatus,
    loadError,
  } = useElementsStore(normalizedSiteKey);
  const actionClass = 'btn-icon h-8 w-8';
  const selectButtonClass = 'btn-ghost h-9 w-full justify-between px-2 text-xs';
  const [activeElementId, setActiveElementId] = useState<string | null>(null);
  const [draftElementId, setDraftElementId] = useState<string | null>(null);
  const [pendingDeleteElementId, setPendingDeleteElementId] = useState<string | null>(null);
  const [addElementType, setAddElementType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const siteElements = useMemo(() => {
    if (!normalizedSiteKey) {
      return [];
    }
    return elements.filter(
      (element) => resolveElementContext(element, normalizedSiteKey).siteKey === normalizedSiteKey,
    );
  }, [elements, normalizedSiteKey]);
  const firstSiteElementContext = useMemo(
    () => (siteElements[0] ? resolveElementContext(siteElements[0], normalizedSiteKey) : null),
    [siteElements, normalizedSiteKey],
  );
  const currentSite = useMemo(() => {
    if (normalizedSiteKey) {
      return buildDefaultSiteUrl(normalizedSiteKey);
    }
    return firstSiteElementContext?.siteUrl || 'site';
  }, [firstSiteElementContext?.siteUrl, normalizedSiteKey]);
  const activeElement = siteElements.find((element) => element.id === activeElementId) ?? null;
  const pendingDeleteElement = pendingDeleteElementId
    ? siteElements.find((item) => item.id === pendingDeleteElementId) ?? null
    : null;
  const [editElement, setEditElement] = useState<StoredElementRecord | null>(activeElement);
  const [flowDrawerOpen, setFlowDrawerOpen] = useState(false);
  const [draftFlow, setDraftFlow] = useState({
    name: '',
    description: '',
    steps: [] as FlowStepData[],
  });
  const applyRecordedEvent = useCallback((event: FlowRecordingEventPayload) => {
    setDraftFlow((prev) => ({
      ...prev,
      steps: appendRecordedEventToSteps(prev.steps, event),
    }));
  }, []);
  const {
    isRecording,
    recordingFeedback,
    startRecording,
    stopRecording,
  } = useFlowRecording({
    pageUrl,
    tabId,
    onRecordingEvent: applyRecordedEvent,
  });
  useEffect(() => {
    setActiveElementId(null);
    setDraftElementId(null);
    setSearchQuery('');
    setTypeFilter('all');
    setPendingDeleteElementId(null);
    setInjectionError('');
  }, [normalizedSiteKey]);

  const typeOptions = useMemo(() => {
    const types = new Set(siteElements.map((element) => getElementType(element)));
    return ['all', ...Array.from(types).sort()];
  }, [siteElements]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredElements = useMemo(() => {
    return siteElements.filter((element) => {
      if (typeFilter !== 'all' && getElementType(element) !== typeFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const context = resolveElementContext(element, normalizedSiteKey);
      const haystack =
        `${element.text} ${getElementType(element)} ${context.pageUrl} ${getElementSelector(element)} ${getElementHref(element)}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [siteElements, normalizedQuery, typeFilter, normalizedSiteKey]);
  const elementsByPage = filteredElements.reduce<Record<string, typeof filteredElements>>((acc, element) => {
    const context = resolveElementContext(element, normalizedSiteKey);
    const pageGroupKey = context.pageKey || context.siteKey || 'unknown';
    const pageKey = pageGroupKey;
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
  const readOnlyReason = t(
    'sidepanel_elements_no_active_page_readonly',
    'Read-only mode without an active page.',
  );
  const [injectionError, setInjectionError] = useState('');
  const previewTimerRef = useRef<number | null>(null);
  const suppressPreviewElementIdRef = useRef<string | null>(null);
  const latestDraftElementIdRef = useRef<string | null>(draftElementId);
  const draftFlowSeedNameRef = useRef('');
  const elementTargetTabId = hasActivePage && typeof tabId === 'number' ? tabId : undefined;
  const sendElementMessage = useCallback(
    async (type: MessageType, payload?: Record<string, unknown>) => {
      try {
        await sendElementMessageShared(type, payload, { targetTabId: elementTargetTabId });
      } catch (error) {
        console.warn('Failed to send element message', type, error);
        throw error;
      }
    },
    [elementTargetTabId],
  );

  const handlePersistFailure = useCallback((error: unknown) => {
    console.warn('elements-persist-failed', error);
    const message = error instanceof Error ? error.message : String(error);
    setInjectionError(message);
  }, []);

  const { latestElementsRef, runElementsWrite } = useElementsWriteQueue({
    normalizedSiteKey,
    elements,
    flows,
    setElements,
    setFlows,
    onPersistFailure: handlePersistFailure,
  });

  useEffect(() => {
    latestDraftElementIdRef.current = draftElementId;
  }, [draftElementId]);

  useEffect(() => {
    const runtime = chrome?.runtime;
    if (!runtime?.onMessage) {
      return;
    }
    const handleRuntimeMessage = (rawMessage: RuntimeMessage) => {
      if (!rawMessage?.forwarded || rawMessage.type !== MessageType.ELEMENT_DRAFT_UPDATED) {
        return;
      }
      const normalized = normalizeStoredElement(rawMessage.data?.element || null, normalizedSiteKey);
      if (!normalized) {
        return;
      }
      if (resolveElementContext(normalized, normalizedSiteKey).siteKey !== normalizedSiteKey) {
        return;
      }
      const shouldPersist = normalized.id !== latestDraftElementIdRef.current;
      if (!shouldPersist) {
        setElements((prev) => {
          const index = prev.findIndex((item) => item.id === normalized.id);
          if (index === -1) {
            return prev;
          }
          const next = prev.slice();
          next[index] = normalized;
          latestElementsRef.current = next;
          return next;
        });
        setEditElement((prev) => (prev?.id === normalized.id ? normalized : prev));
        setInjectionError('');
        return;
      }
      void runElementsWrite('draft-update', ({ elements: baseElements, flows: baseFlows }) => {
        const index = baseElements.findIndex((item) => item.id === normalized.id);
        if (index === -1) {
          return null;
        }
        const next = baseElements.slice();
        next[index] = normalized;
        return { elements: next, flows: baseFlows };
      })
        .then(() => {
          setEditElement((prev) => (prev?.id === normalized.id ? normalized : prev));
          setInjectionError('');
        })
        .catch(() => undefined);
    };
    runtime.onMessage.addListener(handleRuntimeMessage);
    return () => runtime.onMessage.removeListener(handleRuntimeMessage);
  }, [normalizedSiteKey, runElementsWrite, setElements]);

  useEffect(() => {
    if (!hasActivePage || !normalizedSiteKey) {
      sendElementMessage(MessageType.SET_EDITING_ELEMENT, { id: undefined }).catch((error) =>
        setInjectionError(error instanceof Error ? error.message : String(error)),
      );
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
        textAlign: 'center',
        padding: '8px 16px',
        borderRadius: '2px',
      },
    },
    {
      value: 'button-outline',
      label: t('sidepanel_elements_style_outline', 'Outline'),
      styles: {
        backgroundColor: 'transparent',
        color: '#2563eb',
        border: '2px solid #2563eb',
        textAlign: 'center',
        padding: '8px 16px',
        borderRadius: '2px',
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
      if (element.placement.containerId) {
        acc[element.placement.containerId] = (acc[element.placement.containerId] ?? 0) + 1;
      }
      return acc;
    }, {});
  }, [siteElements]);
  const flowSiteKey = useMemo(
    () => {
      if (editElement) {
        return resolveElementContext(editElement, normalizedSiteKey).siteKey;
      }
      if (activeElement) {
        return resolveElementContext(activeElement, normalizedSiteKey).siteKey;
      }
      return normalizeSiteKey(siteKey || '');
    },
    [activeElement, editElement, normalizedSiteKey, siteKey],
  );
  const filteredFlows = useMemo(() => {
    if (!flowSiteKey) {
      return flows;
    }
    return flows.filter((flow) => flow.siteKey === flowSiteKey);
  }, [flows, flowSiteKey]);
  const actionFlowOptions = useMemo(
    () => [
      { value: '__create__', label: t('sidepanel_flows_create_new', 'Create new flow…'), sticky: true },
      { value: '', label: t('sidepanel_field_unassigned', 'Unassigned') },
      ...filteredFlows.map((flow) => ({
        value: flow.id,
        label: flow.name,
        rightLabel: t('sidepanel_steps_count', '{count} steps').replace(
          '{count}',
          String(getStepCount(flow.steps)),
        ),
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
    'margin',
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
    const formatted = formatLocalDateTime(value);
    if (!formatted) {
      return t('sidepanel_label_unknown', 'Unknown');
    }
    return formatted;
  };

  const handleCreateFlow = async () => {
    const name = draftFlow.name.trim() || t('sidepanel_flows_new_default', 'New flow');
    const description = draftFlow.description.trim();
    const flowSiteKey =
      (activeElement ? resolveElementContext(activeElement, normalizedSiteKey).siteKey : '') ||
      normalizedSiteKey ||
      deriveSiteKey(siteKey || '') ||
      '';
    if (!flowSiteKey) {
      return;
    }
    const nextFlow = {
      id: `flow-${Date.now()}`,
      name,
      description,
      scope: 'site' as const,
      siteKey: flowSiteKey,
      pageKey: null,
      steps: draftFlow.steps,
      updatedAt: Date.now(),
    };
    try {
      await runElementsWrite('create-flow', ({ elements: baseElements, flows: baseFlows }) => ({
        elements: baseElements,
        flows: [...baseFlows, nextFlow],
      }));
    } catch (error) {
      return;
    }
    setEditElement((prev) =>
      prev
        ? {
            ...prev,
            behavior: {
              ...prev.behavior,
              actionFlowId: nextFlow.id,
            },
            updatedAt: Date.now(),
          }
        : prev,
    );
    void stopRecording({ silent: true });
    setFlowDrawerOpen(false);
  };

  const closeFlowDrawer = useCallback(() => {
    void stopRecording({ silent: true });
    setFlowDrawerOpen(false);
  }, [stopRecording]);

  const renderFlowSummary = (onSave: () => void) => (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" className="btn-primary gap-1 text-xs" disabled>
          <Play className="h-3.5 w-3.5" />
          {t('sidepanel_action_run', 'Run')}
        </button>
        <button
          type="button"
          className="btn-primary gap-1 text-xs"
          onClick={onSave}
          disabled={!hasActivePage || isRecording}
          title={
            !hasActivePage
              ? readOnlyReason
              : isRecording
                ? t('sidepanel_flow_recording_stop_before_save', 'Stop recording before saving or running.')
                : undefined
          }
        >
          <Check className="h-3.5 w-3.5" />
          {t('sidepanel_action_save', 'Save')}
        </button>
      </div>
      <div className="grid gap-2 rounded-xl border border-border bg-card/60 p-3">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <button
              type="button"
              className="btn-icon h-8 w-8 text-destructive"
              onClick={() => void stopRecording()}
              aria-label={t('sidepanel_flow_recording_stop', 'Stop recording')}
              title={t('sidepanel_flow_recording_stop', 'Stop recording')}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              className="btn-icon h-8 w-8 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void startRecording()}
              disabled={!hasActivePage}
              aria-label={!hasActivePage ? readOnlyReason : t('sidepanel_flow_recording_start', 'Start recording')}
              title={!hasActivePage ? readOnlyReason : t('sidepanel_flow_recording_start', 'Start recording')}
            >
              <Circle className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {t('sidepanel_flow_recording_status_label', 'Recorder')}
            </p>
            <p className="text-[11px] text-muted-foreground">{flowRecordingHelperText}</p>
          </div>
        </div>
      </div>
    </>
  );

  const flowRecordingHelperText = isRecording
    ? recordingFeedback || t('sidepanel_flow_recording_hint_basic', 'Record clicks and inputs from the page.')
    : t('sidepanel_flow_recording_hint_basic', 'Record clicks and inputs from the page.');

  const getElementLabel = (element: ElementRecord) => {
    const text = element.text?.trim();
    if (text) {
      return text;
    }
    const selector = getElementSelector(element).trim();
    if (selector) {
      return selector;
    }
    return t('sidepanel_elements_default_label', '{type} element').replace(
      '{type}',
      getElementTypeLabel(getElementType(element)),
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

  const getPageLabel = (pageUrl: string, siteUrl: string) =>
    getPageLabelFn(pageUrl, siteUrl, t('sidepanel_label_unknown_page', 'Unknown page'));
  const getElementDetail = (element: ElementRecord) => {
    const type = getElementType(element).toLowerCase();
    if (type === 'button') {
      if (element.behavior.actionFlowId) {
        return t('sidepanel_elements_action_flow_value', 'Action flow: {value}').replace(
          '{value}',
          element.behavior.actionFlowId,
        );
      }
      return t('sidepanel_elements_action_flow_unassigned', 'Action flow: Unassigned');
    }
    if (type === 'link') {
      return t('sidepanel_elements_link_value', 'Link: {value}').replace(
        '{value}',
        getElementHref(element) || t('sidepanel_field_unassigned', 'Unassigned'),
      );
    }
    if (type === 'area') {
      const count = areaChildCounts[element.id] ?? 0;
      return t('sidepanel_elements_contains_count', 'Contains {count} elements').replace(
        '{count}',
        String(count),
      );
    }
    const selector = getElementSelector(element);
    return selector
      ? t('sidepanel_elements_selector_value', 'Selector: {value}').replace('{value}', selector)
      : t('sidepanel_elements_detail_not_set', 'Detail: Not set');
  };
  const getElementDetailRows = (element: ElementRecord) => {
    const context = resolveElementContext(element, normalizedSiteKey);
    const rows = [
      { label: t('sidepanel_field_type', 'Type'), value: getElementTypeLabel(getElementType(element)) },
      {
        label: t('sidepanel_field_scope', 'Scope'),
        value:
          getElementScope(element) === 'site'
            ? t('sidepanel_scope_site', 'Site')
            : getElementScope(element) === 'global'
              ? t('sidepanel_scope_global', 'Global')
              : t('sidepanel_scope_page', 'Page'),
      },
      { label: t('sidepanel_field_site', 'Site'), value: context.siteUrl || t('sidepanel_label_unknown', 'Unknown') },
      { label: t('sidepanel_field_page', 'Page'), value: getPageLabel(context.pageUrl, context.siteUrl || currentSite) },
      {
        label: t('sidepanel_field_selector', 'Selector'),
        value: getElementSelector(element) || t('sidepanel_field_not_set', 'Not set'),
      },
    ];
    const type = getElementType(element).toLowerCase();
    if (type === 'button') {
      rows.push({
        label: t('sidepanel_field_action_flow', 'Action flow'),
        value: element.behavior.actionFlowId || t('sidepanel_field_not_set', 'Not set'),
      });
    }
    if (type === 'link') {
      rows.push({
        label: t('sidepanel_field_link', 'Link'),
        value: getElementHref(element) || t('sidepanel_field_not_set', 'Not set'),
      });
    }
    if (type === 'area') {
      rows.push({
        label: t('sidepanel_field_layout', 'Layout'),
        value:
          getElementLayout(element) === 'column'
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

  const detectStylePreset = (style: Record<string, string> = {}) =>
    detectStylePresetFn(stylePresets as StylePreset[], style);

  const formatCustomCss = (rules: Record<string, string>) =>
    formatCustomCssFn(rules, customCssOrder);

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
      const rawValue = value ?? '';
      if (rawValue.trim()) {
        nextCustom[key] = rawValue;
      } else {
        delete nextCustom[key];
      }
    });
    const nextCustomCss = formatCustomCss(nextCustom);
    const nextInline = { ...(editElement.style?.inline || {}) };
    Object.entries(updates).forEach(([key, value]) => {
      const rawValue = value ?? '';
      if (rawValue.trim()) {
        nextInline[key] = rawValue;
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
    if (editElement?.style?.inline?.[key] !== undefined) {
      return editElement.style.inline[key] || '';
    }
    if (customStyleOverrides[key] !== undefined) {
      return customStyleOverrides[key] || '';
    }
    return editElement?.style?.inline?.[key] || '';
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

  const resolveColorValue = (value: string, fallback: string) => resolveColorValueFn(value, fallback);

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
  const marginValue = getStyleValue('margin');
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
      scope: activeElement.scope || 'page',
      placement: {
        ...activeElement.placement,
        selector: activeElement.placement.selector || '',
        position: normalizeElementPosition(activeElement.placement.position),
      },
      behavior: {
        ...activeElement.behavior,
        type: isElementType(activeElement.behavior.type) ? activeElement.behavior.type : 'button',
        href: activeElement.behavior.href || '',
        target: activeElement.behavior.target || 'new-tab',
        layout: activeElement.behavior.layout || 'row',
        actionFlowId: activeElement.behavior.actionFlowId || '',
        actionFlowLocked: Boolean(activeElement.behavior.actionFlowLocked),
      },
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
    setDraftFlow({ name: draftFlowSeedNameRef.current, description: '', steps: [] });
    draftFlowSeedNameRef.current = '';
  }, [flowDrawerOpen]);

  const createElementId = () =>
    `element-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const defaultSiteKey = normalizedSiteKey || firstSiteElementContext?.siteKey || '';
  const defaultSiteUrl =
    firstSiteElementContext?.siteUrl ||
    (defaultSiteKey ? buildDefaultSiteUrl(defaultSiteKey) : 'https://example.com');
  const defaultPageKey =
    pageKey ||
    firstSiteElementContext?.pageKey ||
    (defaultSiteKey ? `${defaultSiteKey}/` : null);
  const currentPageScopedKey = normalizePageKey(pageUrl || pageKey, defaultSiteKey);
  const defaultPageUrl =
    pageUrl ||
    resolveStructuredPageUrl(defaultSiteKey, defaultPageKey, 'page') ||
    firstSiteElementContext?.pageUrl ||
    defaultSiteUrl;
  const defaultFrameUrl = firstSiteElementContext?.frameUrl || defaultPageUrl;

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
        text: t('sidepanel_elements_add_area', 'Area'),
        scope: 'page',
        context: {
          siteKey: defaultSiteKey,
          pageKey: defaultPageKey,
          frame: {
            url: defaultFrameUrl,
            selectors: [],
          },
        },
        placement: {
          mode: 'floating',
          selector: 'body',
          position: 'append',
          relativeTo: {},
        },
        style: {
          preset: detectStylePreset(areaInline),
          inline: areaInline,
          customCss: formatCustomCss(areaInline),
        },
        behavior: {
          type: 'area',
          layout: 'row',
        },
        createdAt: now,
        updatedAt: now,
      };
      try {
        await runElementsWrite('create-area', ({ elements: baseElements, flows: baseFlows }) => ({
          elements: [newArea, ...baseElements],
          flows: baseFlows,
        }));
      } catch (error) {
        setAddElementType('');
        return;
      }
      sendElementMessage(MessageType.CREATE_ELEMENT, { element: toMessageElementPayload(newArea) })
        .then(() => {
          setInjectionError('');
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
              borderRadius: '2px',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '600',
              textAlign: 'center',
              padding: '8px 16px',
            };
    const newElement: ElementRecord = {
      id: createElementId(),
      text:
        normalizedType === 'tooltip'
          ? t('sidepanel_elements_add_tooltip', 'Tooltip')
          : normalizedType === 'link'
            ? t('sidepanel_elements_add_link', 'Link')
            : t('sidepanel_elements_add_button', 'Button'),
      scope: 'page',
      context: {
        siteKey: defaultSiteKey,
        pageKey: defaultPageKey,
        frame: {
          url: defaultFrameUrl,
          selectors: [],
        },
      },
        placement: {
          mode: attachToArea ? 'container' : 'dom',
          selector,
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
        relativeTo: {
          before: attachToArea ? undefined : beforeSelector,
          after: attachToArea ? undefined : afterSelector,
        },
      },
      style: {
        preset: detectStylePreset(elementInline),
        inline: elementInline,
        customCss: formatCustomCss(elementInline),
      },
      behavior: {
        type: normalizedType,
        tooltipPosition: normalizedType === 'tooltip' ? 'top' : undefined,
        tooltipPersistent: normalizedType === 'tooltip' ? false : undefined,
        href: normalizedType === 'link' ? 'https://example.com' : undefined,
        target: normalizedType === 'link' ? 'new-tab' : undefined,
      },
      createdAt: now,
      updatedAt: now,
    };
    try {
      await runElementsWrite('create-element', ({ elements: baseElements, flows: baseFlows }) => ({
        elements: [newElement, ...baseElements],
        flows: baseFlows,
      }));
    } catch (error) {
      setAddElementType('');
      return;
    }
    sendElementMessage(MessageType.CREATE_ELEMENT, { element: toMessageElementPayload(newElement) })
      .then(() => {
        setInjectionError('');
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

  const handleElementSave = async () => {
    if (!editElement) {
      return;
    }
    const normalizedScope = normalizeElementScope(editElement.scope);
    const normalizedElementSiteKey =
      deriveSiteKey(editElement.context.siteKey || '') || normalizedSiteKey;
    const normalizedExistingPageKey = normalizePageKey(
      editElement.context.pageKey || '',
      normalizedElementSiteKey,
    );
    const normalizedActivePageKey = normalizePageKey(pageUrl || pageKey, normalizedElementSiteKey);
    const normalizedPageKey =
      normalizedScope === 'page'
        ? normalizedExistingPageKey || normalizedActivePageKey || editElement.context.pageKey || null
        : null;
    const savedElement: StoredElementRecord = {
      ...editElement,
      scope: normalizedScope,
      context: {
        ...editElement.context,
        siteKey: normalizedElementSiteKey || editElement.context.siteKey,
        pageKey: normalizedPageKey,
      },
      updatedAt: Date.now(),
    };
    try {
      await runElementsWrite('save-element', ({ elements: baseElements, flows: baseFlows }) => ({
        elements: baseElements.map((item) => (item.id === editElement.id ? savedElement : item)),
        flows: baseFlows,
      }));
    } catch (error) {
      return;
    }
    sendElementMessage(MessageType.UPDATE_ELEMENT, { element: toMessageElementPayload(savedElement) })
      .then(() => {
        setInjectionError('');
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
    if (!hasActivePage) {
      return;
    }
    setPendingDeleteElementId(id);
  };

  const performDeleteElement = async (id: string) => {
    if (activeElementId === id) {
      setActiveElementId(null);
    }
    if (draftElementId === id) {
      setDraftElementId(null);
    }
    try {
      await runElementsWrite('delete-element', ({ elements: baseElements, flows: baseFlows }) => ({
        elements: baseElements.filter((item) => item.id !== id),
        flows: baseFlows,
      }));
    } catch (error) {
      return;
    }
    sendElementMessage(MessageType.DELETE_ELEMENT, { id })
      .then(() => {
        setInjectionError('');
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
    const editingType = editElement ? getElementType(editElement) : undefined;
    if (onStartElementPicker) {
      result = await onStartElementPicker({
        disallowInput: editingType === 'button' || editingType === 'link',
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
      placement: {
        ...editElement.placement,
        selector: result.selector,
        relativeTo: {
          before: attachToArea ? undefined : result.beforeSelector || undefined,
          after: attachToArea ? undefined : result.afterSelector || undefined,
        },
        containerId: attachToArea ? result.containerId : undefined,
        mode: attachToArea ? 'container' : 'dom',
        position:
          attachToArea
            ? 'append'
            : result.beforeSelector
              ? 'before'
              : result.afterSelector
                ? 'after'
                : getElementPosition(editElement),
      },
      updatedAt: Date.now(),
    });
    setInjectionError('');
  };

  const closeDetails = useCallback(async () => {
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
      try {
        await runElementsWrite('close-draft-delete', ({ elements: baseElements, flows: baseFlows }) => ({
          elements: baseElements.filter((item) => item.id !== closingId),
          flows: baseFlows,
        }));
      } catch (error) {
        return;
      }
      sendElementMessage(MessageType.DELETE_ELEMENT, { id: closingId })
        .then(() => {
          setInjectionError('');
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          setInjectionError(message);
        });
      setDraftElementId(null);
    }
    setActiveElementId(null);
  }, [
    activeElementId,
    draftElementId,
    previewTimerRef,
    runElementsWrite,
    sendElementMessage,
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
      sendElementMessage(MessageType.PREVIEW_ELEMENT, { element: toMessageElementPayload(editElement) }).catch((error) =>
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
    <ElementCard
      key={element.id}
      element={element}
      typeLabel={getElementTypeLabel(getElementType(element))}
      elementLabel={getElementLabel(element)}
      detail={getElementDetail(element)}
      timestampLabel={formatTimestamp(element.updatedAt)}
      hasActivePage={hasActivePage}
      readOnlyReason={readOnlyReason}
      actionClass={actionClass}
      onSelect={() => handleSelectElement(element.id)}
      onFocus={handleFocusElement}
      onDelete={handleDeleteElement}
    />
  );

  return (
    <div className="flex flex-col gap-2">
      {injectionError ? (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {getInjectionErrorMessage(injectionError)}
        </div>
      ) : null}
      {siteDataStatus === 'error' ? (
        <div className="rounded border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {loadError
            ? `${t('sidepanel_elements_load_error', 'Failed to load elements. Please try refreshing.')}: ${loadError}`
            : t('sidepanel_elements_load_error', 'Failed to load elements. Please try refreshing.')}
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
              className="btn-ghost gap-1 px-3"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
            >
              <X className="h-3.5 w-3.5" />
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
      ) : null}

      {siteElements.length === 0 ? (
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
            const pageSite = pageElements[0]
              ? resolveElementContext(pageElements[0], normalizedSiteKey).siteUrl
              : currentSite;
            const isSiteScopeGroup =
              pageElements.length > 0 &&
              pageElements.every((element) => normalizeElementScope(element.scope) === 'site');
            return (
              <div key={page} className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                    <LinkIcon className="h-3.5 w-3.5" />
                  </span>
                  <p
                    className="max-w-[220px] truncate text-sm font-semibold text-card-foreground"
                    title={
                      isSiteScopeGroup
                        ? `${t('sidepanel_elements_group_site_scope', 'Site-wide')} (${getPageLabel(page, pageSite)})`
                        : getPageLabel(page, pageSite)
                    }
                  >
                    {isSiteScopeGroup
                      ? t('sidepanel_elements_group_site_scope', 'Site-wide')
                      : getPagePathLabel(page, pageSite)}
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
                    .filter((element) => getElementType(element) === 'area')
                    .map((area) => ({
                      area,
                      children: pageElements.filter(
                        (element) =>
                          element.id !== area.id && element.placement.containerId === area.id,
                      ),
                    }));
                  const groupedChildIds = new Set(
                    areaGroups.flatMap((group) => group.children.map((child) => child.id)),
                  );
                  const ungroupedElements = pageElements.filter(
                    (element) => getElementType(element) !== 'area' && !groupedChildIds.has(element.id),
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
                {getElementTypeLabel(getElementType(activeElement))}
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
              onClick={() => {
                void closeDetails();
              }}
              aria-label={t('sidepanel_action_cancel', 'Cancel')}
              title={t('sidepanel_action_cancel', 'Cancel')}
            >
              <X className="h-4 w-4" />
            </button>
      <button
        type="button"
        className="btn-icon btn-icon-primary h-8 w-8"
        onClick={() => {
          void handleElementSave();
        }}
        disabled={!hasActivePage}
        aria-label={t('sidepanel_action_save', 'Save')}
        title={hasActivePage ? t('sidepanel_action_save', 'Save') : readOnlyReason}
      >
        <Check className="h-4 w-4" />
      </button>
    </>
  }
  showClose={false}
        onClose={() => {
          void closeDetails();
        }}
>
        {editElement ? (
          <div className="grid gap-3 text-xs text-muted-foreground">
            <ElementBasicsAction
              editElement={editElement}
              actionFlowOptions={actionFlowOptions}
              selectButtonClass={selectButtonClass}
              currentPageScopedKey={currentPageScopedKey}
              defaultPageKey={defaultPageKey}
              onChangeEditElement={setEditElement}
              onRequestCreateFlow={(seedName) => {
                draftFlowSeedNameRef.current = seedName;
                setFlowDrawerOpen(true);
              }}
            />
            <ElementStyleEditor
              stylePresets={stylePresets}
              currentPresetValue={editElement.style?.preset || ''}
              shadowOptions={shadowOptions}
              positionOptions={positionOptions}
              customCssValue={editElement.style?.customCss || ''}
              selectButtonClass={selectButtonClass}
              isBold={isBold}
              isItalic={isItalic}
              isUnderline={isUnderline}
              textAlignValue={textAlignValue}
              textColorValue={textColorValue}
              backgroundColorValue={backgroundColorValue}
              borderValue={borderValue}
              borderRadiusValue={borderRadiusValue}
              boxShadowValue={boxShadowValue}
              paddingValue={paddingValue}
              marginValue={marginValue}
              positionValue={positionValue}
              widthValue={widthValue}
              heightValue={heightValue}
              leftValue={leftValue}
              topValue={topValue}
              zIndexValue={zIndexValue}
              onApplyStylePreset={applyStylePreset}
              onApplyCustomCssUpdates={applyCustomCssUpdates}
              onApplyCustomCssText={applyCustomCssText}
              onAdjustNumericStyle={adjustNumericStyle}
              onUpdateNumericStyle={updateNumericStyle}
              resolveColorValue={resolveColorValue}
              renderColorSwatches={renderColorSwatches}
            />
          </div>
        ) : null}
      </Drawer>

      <FlowDrawer
        open={flowDrawerOpen}
        title={t('sidepanel_flows_new_title', 'New flow')}
        subtitle={t('sidepanel_flows_new_subtitle', 'Create a new action flow.')}
        onClose={closeFlowDrawer}
        summary={renderFlowSummary(() => {
          void handleCreateFlow();
        })}
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
          <FlowStepsBuilder
            steps={draftFlow.steps}
            onChange={(steps) => setDraftFlow((prev) => ({ ...prev, steps }))}
            onStartPicker={onStartFlowPicker}
          />
        </div>
      </FlowDrawer>
      <ConfirmDialog
        open={Boolean(pendingDeleteElementId)}
        title={t('sidepanel_elements_delete', 'Delete element')}
        message={t('sidepanel_elements_delete_confirm', 'Delete "{name}"? This action cannot be undone.').replace(
          '{name}',
          pendingDeleteElement
            ? getElementLabel(pendingDeleteElement)
            : t('sidepanel_elements_delete', 'Delete element'),
        )}
        confirmLabel={t('sidepanel_action_delete', 'Delete')}
        cancelLabel={t('sidepanel_action_cancel', 'Cancel')}
        danger
        onCancel={() => setPendingDeleteElementId(null)}
        onConfirm={() => {
          const targetId = pendingDeleteElementId;
          setPendingDeleteElementId(null);
          if (!targetId) {
            return;
          }
          void performDeleteElement(targetId);
        }}
      />
    </div>
  );
}
