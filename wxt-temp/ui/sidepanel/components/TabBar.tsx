import type { TabBarProps } from '../types';

export default function TabBar({ tabs, activeId, onChange }: TabBarProps) {
  return (
    <nav className="-mx-2 flex border-b border-border bg-card shadow-sm">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            className={`btn-tab ${isActive ? 'btn-tab-active' : ''}`}
            onClick={() => onChange(tab.id)}
            title={tab.tooltip ?? tab.label}
          >
            <span className="flex flex-col items-center justify-center gap-1">
              {tab.icon && <span className="text-base">{tab.icon}</span>}
              <span className="text-xs">{tab.label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}



