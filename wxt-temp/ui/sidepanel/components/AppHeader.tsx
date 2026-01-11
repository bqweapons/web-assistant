import type { AppHeaderProps } from '../types';
import TabBar from './TabBar';

export default function AppHeader({ title, context, actions, tabs, activeTabId, onTabChange }: AppHeaderProps) {
  const showTabs = tabs && activeTabId && onTabChange;
  return (
    <header className="sticky top-0 z-10 bg-background px-4 pt-4 backdrop-blur">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/icon/128.png"
              alt={`${title} logo`}
              className="h-9 w-9 rounded object-cover"
            />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              action.icon ? (
                <button
                  key={action.label}
                  type="button"
                  className="btn-icon"
                  aria-label={action.label}
                  onClick={action.onClick}
                >
                  {action.icon}
                </button>
              ) : (
                <button
                  key={action.label}
                  type="button"
                  className={action.variant === 'primary' ? 'btn-primary' : 'btn-ghost'}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              )
            ))}
          </div>
        </div>
        {showTabs ? (
          <div className="-mx-4 border-y border-border bg-card shadow-sm">
            <TabBar tabs={tabs} activeId={activeTabId} onChange={onTabChange} />
          </div>
        ) : null}
      </div>
    </header>
  );
}



