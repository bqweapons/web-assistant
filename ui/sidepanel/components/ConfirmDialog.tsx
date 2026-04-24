import { useId, useRef } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
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

  // 2.8 — focus trap owns Escape, initial focus, Tab wrap, and prior-focus
  // restore. Replaces the previous local Esc listener + panelRef.focus()
  // pair. Open-or-not gating is via the `open` argument; the hook is a
  // no-op while `open === false`.
  useFocusTrap(panelRef, open, onCancel);

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
              className={`h-8 gap-1 px-3 text-xs ${danger ? 'btn-danger' : 'btn-primary'}`}
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
