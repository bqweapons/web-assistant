import { useEffect, useMemo, useState } from 'react';
import AppHeader from './components/AppHeader';
import TabBar from './components/TabBar';
import ElementsSection from './sections/ElementsSection';
import FlowsSection from './sections/FlowsSection';
import HiddenRulesSection from './sections/HiddenRulesSection';
import OverviewSection from './sections/OverviewSection';
import SettingsSection from './sections/SettingsSection';
import SettingsPopover from './components/SettingsPopover';
import { ChevronDown, EyeOff, Layers, LayoutDashboard, Moon, Settings, Sun, Workflow } from 'lucide-react';

const TAB_IDS = {
  elements: 'elements',
  flows: 'flows',
  hiddenRules: 'hiddenRules',
  overview: 'overview',
};

export default function App() {
  const tabs = useMemo(
    () => [
      { id: TAB_IDS.elements, label: 'Elements', icon: <Layers className="h-4 w-4" /> },
      { id: TAB_IDS.hiddenRules, label: 'Hidden', icon: <EyeOff className="h-4 w-4" /> },
      { id: TAB_IDS.flows, label: 'Flows', icon: <Workflow className="h-4 w-4" /> },
      { id: TAB_IDS.overview, label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
    [],
  );
  const [activeTab, setActiveTab] = useState(TAB_IDS.elements);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

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
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader
        title="Ladybird"
        context="No active page"
        actions={headerActions}
      />

      <main className="px-2 pb-6">
        <TabBar tabs={tabs} activeId={activeTab} onChange={setActiveTab} />

        {activeTab === TAB_IDS.elements && (
          <div className="mt-2">
            <details className="group relative">
              <summary className="btn-primary w-full cursor-pointer list-none">
                <span className="inline-flex items-center justify-center gap-2">
                  Add element to page
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </span>
              </summary>
              <div className="absolute left-0 right-0 z-10 mt-2 rounded-theme border border-border bg-card p-2 shadow-md">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 rounded-theme px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-muted"
                  >
                    <span>Area</span>
                    <span className="text-xs text-muted-foreground">Select a region</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 rounded-theme px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-muted"
                  >
                    <span>Button</span>
                    <span className="text-xs text-muted-foreground">Insert a clickable button</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 rounded-theme px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-muted"
                  >
                    <span>Tooltip</span>
                    <span className="text-xs text-muted-foreground">Show helper text on hover</span>
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}

        {activeTab === TAB_IDS.hiddenRules && (
          <div className="mt-2">
            <details className="group relative">
              <summary className="btn-primary w-full cursor-pointer list-none">
                <span className="inline-flex items-center justify-center gap-2">
                  Add hidden rule
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </span>
              </summary>
              <div className="absolute left-0 right-0 z-10 mt-2 rounded-theme border border-border bg-card p-2 shadow-md">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 rounded-theme px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-muted"
                  >
                    <span>This page</span>
                    <span className="text-xs text-muted-foreground">Hide on the current page</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 rounded-theme px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-muted"
                  >
                    <span>This site</span>
                    <span className="text-xs text-muted-foreground">Hide across the site</span>
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}

        {activeTab === TAB_IDS.flows && (
          <div className="mt-2">
            <details className="group relative">
              <summary className="btn-primary w-full cursor-pointer list-none">
                <span className="inline-flex items-center justify-center gap-2">
                  Create flow
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </span>
              </summary>
              <div className="absolute left-0 right-0 z-10 mt-2 rounded-theme border border-border bg-card p-2 shadow-md">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 rounded-theme px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-muted"
                  >
                    <span>Blank flow</span>
                    <span className="text-xs text-muted-foreground">Start from scratch</span>
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-between gap-2 rounded-theme px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-muted"
                  >
                    <span>From template</span>
                    <span className="text-xs text-muted-foreground">Use a preset sequence</span>
                  </button>
                </div>
              </div>
            </details>
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



