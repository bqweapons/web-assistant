import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from './components/AppHeader';
import ElementsSection from './sections/ElementsSection';
import FlowsSection from './sections/FlowsSection';
import HiddenRulesSection from './sections/HiddenRulesSection';
import OverviewSection from './sections/OverviewSection';
import SettingsSection from './sections/SettingsSection';
import SettingsPopover from './components/SettingsPopover';
import PickerOverlay from './components/PickerOverlay';
import { EyeOff, Layers, LayoutDashboard, Moon, Settings, Sun, Workflow } from 'lucide-react';
import { t, useLocale } from './utils/i18n';
import {
  MessageType,
  type PageContextPayload,
  type PickerAccept,
  type PickerResultPayload,
  type RuntimeMessage,
  type SelectorPickerAccept,
} from '../../shared/messages';
import { sendRuntimeMessage } from '../../shared/runtimeMessaging';

const TAB_IDS = {
  elements: 'elements',
  flows: 'flows',
  hiddenRules: 'hiddenRules',
  overview: 'overview',
};

export default function App() {
  const locale = useLocale();
  const tabs = useMemo(
    () => [
      {
        id: TAB_IDS.elements,
        label: t('sidepanel_tab_elements', 'Elements'),
        tooltip: t('sidepanel_tab_elements_tooltip', 'Saved elements and quick actions.'),
        icon: <Layers className="h-4 w-4" />,
      },
      {
        id: TAB_IDS.flows,
        label: t('sidepanel_tab_flows', 'Flows'),
        tooltip: t('sidepanel_tab_flows_tooltip', 'Reusable action flows.'),
        icon: <Workflow className="h-4 w-4" />,
      },
      {
        id: TAB_IDS.hiddenRules,
        label: t('sidepanel_tab_hidden', 'Hidden'),
        tooltip: t('sidepanel_tab_hidden_tooltip', 'Hidden rules for blocking elements.'),
        icon: <EyeOff className="h-4 w-4" />,
      },
      {
        id: TAB_IDS.overview,
        label: t('sidepanel_tab_overview', 'Overview'),
        tooltip: t('sidepanel_tab_overview_tooltip', 'Summary across sites.'),
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
    ],
    [locale],
  );
  const [activeTab, setActiveTab] = useState(TAB_IDS.elements);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [createFlowOpen, setCreateFlowOpen] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [pickerAccept, setPickerAccept] = useState<PickerAccept>('selector');
  const [pageContext, setPageContext] = useState<PageContextPayload | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState('');
  const pickerResolveRef = useRef<((value: PickerResultPayload | null) => void) | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const refreshPageContext = useCallback(async () => {
    setContextLoading(true);
    setContextError('');
    try {
      const data = (await sendRuntimeMessage({
        type: MessageType.GET_ACTIVE_PAGE_CONTEXT,
      })) as PageContextPayload | null | undefined;
      if (data && typeof data === 'object') {
        setPageContext(data);
      } else {
        setPageContext(null);
      }
    } catch (error) {
      setContextError(error instanceof Error ? error.message : String(error));
      setPageContext((prev) => (prev ? { ...prev, hasAccess: false } : null));
    } finally {
      setContextLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPageContext();
  }, [refreshPageContext]);

  const finalizePicker = useCallback((value: PickerResultPayload | null) => {
    if (pickerResolveRef.current) {
      pickerResolveRef.current(value);
      pickerResolveRef.current = null;
    }
    setPickerActive(false);
    setPickerError('');
  }, []);

  const startPicker = useCallback(
    async (
      accept: PickerAccept,
      options?: { disallowInput?: boolean; showInsertionMarker?: boolean },
    ) => {
      if (pickerResolveRef.current) {
        pickerResolveRef.current(null);
        pickerResolveRef.current = null;
      }
      setPickerError('');
      setPickerAccept(accept);
      setPickerActive(true);
      return new Promise<PickerResultPayload | null>((resolve) => {
        pickerResolveRef.current = resolve;
        sendRuntimeMessage({
          type: MessageType.START_PICKER,
          data: {
            accept,
            disallowInput: options?.disallowInput,
            showInsertionMarker: options?.showInsertionMarker,
          },
        })
          .then(() => undefined)
          .catch(() => {
            setPickerError(t('sidepanel_picker_start_error', 'Unable to start picker.'));
            finalizePicker(null);
          });
      });
    },
    [finalizePicker],
  );

  const startSelectorPicker = useCallback(
    (accept: SelectorPickerAccept) =>
      startPicker(accept).then((result) => result?.selector ?? null),
    [startPicker],
  );

  const startSelectorPickerWithoutInsertionMarker = useCallback(
    (accept: SelectorPickerAccept) =>
      startPicker(accept, { showInsertionMarker: false }).then((result) => result?.selector ?? null),
    [startPicker],
  );

  const startSelectorPickerWithNeighbors = useCallback(
    (options?: { disallowInput?: boolean }) =>
      startPicker('selector', options).then((result) =>
        result?.selector
          ? {
              selector: result.selector,
              beforeSelector: result.beforeSelector,
              afterSelector: result.afterSelector,
              containerId: result.containerId,
            }
          : null,
      ),
    [startPicker],
  );

  const startAreaPicker = useCallback(
    () => startPicker('area').then((result) => result?.rect ?? null),
    [startPicker],
  );

  const cancelPicker = useCallback(() => {
    if (!pickerResolveRef.current && !pickerActive) {
      return;
    }
    sendRuntimeMessage({ type: MessageType.CANCEL_PICKER })
      .then(() => undefined)
      .catch(() => undefined);
    finalizePicker(null);
  }, [finalizePicker, pickerActive]);

  useEffect(() => {
    if (!pickerActive) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelPicker();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [cancelPicker, pickerActive]);

  useEffect(() => {
    const handleMessage = (rawMessage: RuntimeMessage) => {
      if (!rawMessage?.type || !rawMessage.forwarded) {
        return;
      }
      switch (rawMessage.type) {
        case MessageType.PICKER_RESULT:
          finalizePicker(rawMessage.data || null);
          break;
        case MessageType.PICKER_CANCELLED:
          finalizePicker(null);
          break;
        case MessageType.PICKER_INVALID:
          if (rawMessage.data?.reason === 'input-required' || pickerAccept === 'input') {
            setPickerError(t('sidepanel_picker_invalid_input', 'Please select an input field.'));
          } else if (rawMessage.data?.reason === 'input-not-allowed') {
            setPickerError(t('sidepanel_picker_invalid_non_input', 'Please select a non-input element.'));
          }
          break;
        case MessageType.ACTIVE_PAGE_CONTEXT:
          setPageContext(rawMessage.data || null);
          setContextError('');
          setContextLoading(false);
          break;
        default:
          break;
      }
    };
    const runtime = chrome?.runtime;
    if (!runtime?.onMessage) {
      return;
    }
    runtime.onMessage.addListener(handleMessage);
    return () => runtime.onMessage.removeListener(handleMessage);
  }, [finalizePicker, locale, pickerAccept]);

  const hasActivePage = Boolean(pageContext?.hasAccess && pageContext.siteKey);
  const headerContext = pageContext?.siteKey
    ? pageContext.siteKey
    : t('sidepanel_header_no_active_site', 'No active site');

  const headerActions = useMemo(
    () => [
      {
        label: isDark
          ? t('sidepanel_action_light_mode', 'Light mode')
          : t('sidepanel_action_dark_mode', 'Dark mode'),
        onClick: () => setIsDark((prev) => !prev),
        icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      },
      {
        label: t('sidepanel_action_settings', 'Settings'),
        onClick: () => setSettingsOpen(true),
        icon: <Settings className="h-4 w-4" />,
      },
    ],
    [isDark, locale],
  );

  return (
    <div className="relative flex h-screen flex-col bg-background text-foreground">
      <AppHeader
        title={t('sidepanel_app_title', 'Ladybird')}
        context={headerContext}
        actions={headerActions}
        tabs={tabs}
        activeTabId={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="flex-1 overflow-y-auto px-4 pb-6">
        {activeTab === TAB_IDS.flows && (
          <div className="mt-2">
            <button
              type="button"
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setCreateFlowOpen(true)}
              disabled={!hasActivePage}
              title={
                hasActivePage
                  ? t('sidepanel_flows_create', 'Create flow')
                  : t('sidepanel_flows_disabled_read_only', 'Read-only mode without an active page.')
              }
            >
              {t('sidepanel_flows_create', 'Create flow')}
            </button>
          </div>
        )}

        <div className="mt-2">
          {activeTab === TAB_IDS.elements && (
            <ElementsSection
              siteKey={pageContext?.siteKey || ''}
              pageKey={pageContext?.pageKey || ''}
              pageUrl={pageContext?.url || ''}
              hasActivePage={hasActivePage}
              isSyncing={contextLoading}
              lastSyncedAt={pageContext?.timestamp}
              onRefresh={refreshPageContext}
              onStartPicker={startSelectorPicker}
              onStartAreaPicker={startAreaPicker}
              onStartElementPicker={startSelectorPickerWithNeighbors}
            />
          )}
          {activeTab === TAB_IDS.flows && (
            <FlowsSection
              siteKey={pageContext?.siteKey || ''}
              hasActivePage={hasActivePage}
              createFlowOpen={createFlowOpen}
              onCreateFlowClose={() => setCreateFlowOpen(false)}
              onStartPicker={startSelectorPickerWithoutInsertionMarker}
            />
          )}
          {activeTab === TAB_IDS.hiddenRules && (
            <HiddenRulesSection
              siteKey={pageContext?.siteKey || ''}
              pageKey={pageContext?.pageKey || ''}
              hasActivePage={hasActivePage}
              onStartPicker={startSelectorPicker}
            />
          )}
          {activeTab === TAB_IDS.overview && <OverviewSection />}
        </div>
      </main>
      <SettingsPopover open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <SettingsSection />
      </SettingsPopover>
      {pickerActive ? (
        <PickerOverlay
          title={
            pickerAccept === 'area'
              ? t('sidepanel_picker_area_title', 'Draw a region')
              : t('sidepanel_picker_title', 'Select an element')
          }
          hint={
            pickerAccept === 'area'
              ? t('sidepanel_picker_area_hint', 'Drag on the page, press Esc to cancel.')
              : t('sidepanel_picker_hint', 'Click the target, press Esc to cancel.')
          }
          error={pickerError || undefined}
          cancelLabel={t('sidepanel_picker_cancel', 'Cancel')}
          onCancel={cancelPicker}
        />
      ) : null}
    </div>
  );
}
