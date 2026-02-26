import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { t } from '../utils/i18n';

type DrawerProps = {
  open: boolean;
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  showClose?: boolean;
  onClose: () => void;
  children?: ReactNode;
};

export default function Drawer({ open, title, description, actions, showClose = true, onClose, children }: DrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-label={t('sidepanel_drawer_close', 'Close drawer')}
      />
      <div className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto w-full max-w-5xl rounded-t-3xl border border-border bg-card text-card-foreground p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-card-foreground">{title}</h3>
              {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              {showClose ? (
                <button
                  type="button"
                  className="btn-icon h-8 w-8"
                  onClick={onClose}
                  aria-label={t('sidepanel_drawer_close', 'Close drawer')}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-3 max-h-[60vh] overflow-y-auto -mx-4 px-4">{children}</div>
        </div>
      </div>
    </>
  );
}
