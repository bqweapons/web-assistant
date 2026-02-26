import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { t } from '../utils/i18n';

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
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={`fixed inset-0 bg-black/40 ${overlayClassName}`}
        onClick={onClose}
        aria-label={t('sidepanel_flow_drawer_close', 'Close flow drawer')}
      />
      <div className={`fixed inset-x-0 bottom-0 ${panelClassName}`}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={subtitle ? descriptionId : undefined}
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl rounded-t-3xl border border-border bg-card text-card-foreground shadow-2xl"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex flex-col gap-1">
              <h3 id={titleId} className="text-base font-semibold text-card-foreground">
                {title}
              </h3>
              {subtitle ? (
                <p id={descriptionId} className="text-xs text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="btn-icon h-8 w-8"
              onClick={onClose}
              aria-label={t('sidepanel_flow_drawer_close', 'Close flow drawer')}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[2fr,1fr]">
            <div className="order-1 max-h-[70vh] overflow-x-hidden overflow-y-auto pr-1">{children}</div>
            <aside className="order-2 flex flex-col gap-3 rounded-2xl border border-border bg-muted p-4 lg:order-none lg:sticky lg:top-4">
              {summary}
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
