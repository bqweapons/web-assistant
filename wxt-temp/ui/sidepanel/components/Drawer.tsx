import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type DrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
};

export default function Drawer({ open, title, description, onClose, children }: DrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-overlay" onClick={onClose} aria-label="Close drawer" />
      <div className="relative w-full max-w-md rounded-theme border border-border bg-card p-4 shadow-2xl sm:mb-6 sm:w-[min(420px,calc(100%-2rem))]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-card-foreground">{title}</h3>
            {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          <button type="button" className="btn-icon h-8 w-8" onClick={onClose} aria-label="Close drawer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 max-h-[60vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
