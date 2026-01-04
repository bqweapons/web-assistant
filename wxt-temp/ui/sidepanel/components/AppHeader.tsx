import type { AppHeaderProps } from '../types';

export default function AppHeader({ title, context, actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
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
      </div>
    </header>
  );
}
