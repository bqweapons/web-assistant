import { useMemo, useState } from 'react';
import AppHeader from './components/AppHeader';
import TabBar from './components/TabBar';
import ElementsSection from './sections/ElementsSection';
import FlowsSection from './sections/FlowsSection';
import OverviewSection from './sections/OverviewSection';
import SettingsSection from './sections/SettingsSection';
import SettingsPopover from './components/SettingsPopover';
import { Settings } from 'lucide-react';

const TAB_IDS = {
  elements: 'elements',
  flows: 'flows',
  overview: 'overview',
};

export default function App() {
  const tabs = useMemo(
    () => [
      { id: TAB_IDS.elements, label: 'Elements' },
      { id: TAB_IDS.flows, label: 'Flows' },
      { id: TAB_IDS.overview, label: 'Overview' },
    ],
    [],
  );
  const [activeTab, setActiveTab] = useState(TAB_IDS.elements);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const headerActions = useMemo(
    () => [
      {
        label: 'Settings',
        onClick: () => setSettingsOpen(true),
        icon: <Settings className="h-4 w-4" />,
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        title="Ladybird"
        context="No active page"
        actions={headerActions}
      />

      <main className="px-4 pb-6">
        <TabBar tabs={tabs} activeId={activeTab} onChange={setActiveTab} />

        <div className="mt-4">
          {activeTab === TAB_IDS.elements && <ElementsSection />}
          {activeTab === TAB_IDS.flows && <FlowsSection />}
          {activeTab === TAB_IDS.overview && <OverviewSection />}
        </div>
      </main>
      <SettingsPopover open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <SettingsSection />
      </SettingsPopover>
    </div>
  );
}
