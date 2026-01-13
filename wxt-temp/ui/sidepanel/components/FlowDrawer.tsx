import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type FlowDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  summary?: ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
};

export default function FlowDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  summary,
  overlayClassName = 'z-40',
  panelClassName = 'z-50',
}: FlowDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 bg-black/40 ${overlayClassName}`}
        onClick={onClose}
        aria-label="Close flow drawer"
      />
      <div className={`fixed inset-x-0 bottom-0 ${panelClassName}`}>
        <div className="mx-auto w-full max-w-5xl rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
              {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              className="btn-icon h-8 w-8"
              onClick={onClose}
              aria-label="Close flow drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[2fr,1fr]">
            <div className="max-h-[70vh] overflow-y-auto pr-1">{children}</div>
            <aside className="flex flex-col gap-3 rounded-2xl border border-border bg-muted p-4">
              {summary}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
