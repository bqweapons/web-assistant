import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { t } from '../utils/i18n';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  zIndexBase?: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  zIndexBase = 100,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
      }
    };
    panelRef.current?.focus();
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] bg-black/40"
        style={{ zIndex: zIndexBase - 10 }}
        onClick={onCancel}
        aria-label={t('sidepanel_action_cancel', 'Cancel')}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: zIndexBase }}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          tabIndex={-1}
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl"
        >
          <h3 id={titleId} className="text-sm font-semibold text-card-foreground">
            {title}
          </h3>
          <p id={messageId} className="mt-2 text-xs text-muted-foreground">
            {message}
          </p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" className="btn-ghost h-8 gap-1 px-3 text-xs" onClick={onCancel}>
              <X className="h-3.5 w-3.5" />
              {cancelLabel || t('sidepanel_action_cancel', 'Cancel')}
            </button>
            <button
              type="button"
              className={`h-8 gap-1 px-3 text-xs ${danger ? 'btn-icon-danger btn-ghost' : 'btn-primary'}`}
              onClick={onConfirm}
            >
              {danger ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {confirmLabel || t('sidepanel_action_delete', 'Delete')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
