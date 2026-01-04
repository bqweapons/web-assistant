import type { TabBarProps } from '../types';

export default function TabBar({ tabs, activeId, onChange }: TabBarProps) {
  return (
    <nav className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            className={`btn-tab ${isActive ? 'btn-tab-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
