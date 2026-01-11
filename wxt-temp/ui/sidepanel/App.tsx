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

const TAB_IDS = {
  elements: 'elements',
  flows: 'flows',
  hiddenRules: 'hiddenRules',
  overview: 'overview',
};

export default function App() {
  const tabs = useMemo(
    () => [
      {
        id: TAB_IDS.elements,
        label: 'Elements',
        tooltip: 'Saved elements and quick actions.',
        icon: <Layers className="h-4 w-4" />,
      },
      {
        id: TAB_IDS.flows,
        label: 'Flows',
        tooltip: 'Reusable action flows.',
        icon: <Workflow className="h-4 w-4" />,
      },
      {
        id: TAB_IDS.hiddenRules,
        label: 'Hidden',
        tooltip: 'Hidden rules for blocking elements.',
        icon: <EyeOff className="h-4 w-4" />,
      },
      {
        id: TAB_IDS.overview,
        label: 'Overview',
        tooltip: 'Summary across sites.',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
    ],
    [],
  );
  const [activeTab, setActiveTab] = useState(TAB_IDS.elements);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [addElementType, setAddElementType] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);


  const headerActions = useMemo(
    () => [
      {
        label: isDark ? 'Light mode' : 'Dark mode',
        onClick: () => setIsDark((prev) => !prev),
        icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      },
      {
        label: 'Settings',
        onClick: () => setSettingsOpen(true),
        icon: <Settings className="h-4 w-4" />,
      },
    ],
    [isDark],
  );

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <AppHeader
        title="Ladybird"
        context="No active page"
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
              placeholder="Add element to page"
              iconPosition="right"
              useInputStyle={false}
              buttonClassName="btn-primary w-full"
              centerLabel
              options={[
                { value: 'area', label: 'Area', rightLabel: 'Select a region' },
                { value: 'button', label: 'Button', rightLabel: 'Insert a clickable button' },
                { value: 'tooltip', label: 'Tooltip', rightLabel: 'Show helper text on hover' },
              ]}
              onChange={(value) => setAddElementType(value)}
            />
          </div>
        )}

        {activeTab === TAB_IDS.hiddenRules && (
          <div className="mt-2">
            <button type="button" className="btn-primary w-full">
              Add hidden rule
            </button>
          </div>
        )}

        {activeTab === TAB_IDS.flows && (
          <div className="mt-2">
            <button type="button" className="btn-primary w-full">
              Create flow
            </button>
          </div>
        )}

        <div className="mt-2">
          {activeTab === TAB_IDS.elements && <ElementsSection />}
          {activeTab === TAB_IDS.flows && <FlowsSection />}
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
