import { useEffect, useMemo, useState } from 'react';
import AppHeader from './components/AppHeader';
import ElementsSection from './sections/ElementsSection';
import FlowsSection from './sections/FlowsSection';
import HiddenRulesSection from './sections/HiddenRulesSection';
import OverviewSection from './sections/OverviewSection';
import SettingsSection from './sections/SettingsSection';
import SettingsPopover from './components/SettingsPopover';
import SelectMenu from './components/SelectMenu';
import { EyeOff, Layers, LayoutDashboard, Moon, Settings, Sun, Workflow } from 'lucide-react';
import { t, useLocale } from './utils/i18n';

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
  const [addElementType, setAddElementType] = useState('');
  const [createFlowOpen, setCreateFlowOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);


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
    <div className="flex h-screen flex-col bg-background text-foreground">
      <AppHeader
        title={t('sidepanel_app_title', 'Ladybird')}
        context={t('sidepanel_app_context_none', 'No active page')}
        actions={headerActions}
        tabs={tabs}
        activeTabId={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="flex-1 overflow-y-auto px-4 pb-6">
        {activeTab === TAB_IDS.elements && (
          <div className="mt-2">
            <SelectMenu
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
                  value: 'tooltip',
                  label: t('sidepanel_elements_add_tooltip', 'Tooltip'),
                  rightLabel: t('sidepanel_elements_add_tooltip_hint', 'Show helper text on hover'),
                },
              ]}
              onChange={(value) => setAddElementType(value)}
            />
          </div>
        )}

        {activeTab === TAB_IDS.hiddenRules && (
          <div className="mt-2">
            <button type="button" className="btn-primary w-full">
              {t('sidepanel_hidden_add', 'Add hidden rule')}
            </button>
          </div>
        )}

        {activeTab === TAB_IDS.flows && (
          <div className="mt-2">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setCreateFlowOpen(true)}
            >
              {t('sidepanel_flows_create', 'Create flow')}
            </button>
          </div>
        )}

        <div className="mt-2">
          {activeTab === TAB_IDS.elements && <ElementsSection />}
          {activeTab === TAB_IDS.flows && (
            <FlowsSection
              createFlowOpen={createFlowOpen}
              onCreateFlowClose={() => setCreateFlowOpen(false)}
            />
          )}
          {activeTab === TAB_IDS.hiddenRules && <HiddenRulesSection />}
          {activeTab === TAB_IDS.overview && <OverviewSection />}
        </div>
      </main>
      <SettingsPopover open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <SettingsSection />
      </SettingsPopover>
    </div>
  );
}
