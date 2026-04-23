import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react';
import { t } from '../utils/i18n';

type PasswordPromptDialogProps = {
  open: boolean;
  title: string;
  message: string;
  submitLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  zIndexBase?: number;
  onSubmit: (password: string) => void;
  onCancel: () => void;
};

export default function PasswordPromptDialog({
  open,
  title,
  message,
  submitLabel,
  cancelLabel,
  placeholder,
  zIndexBase = 100,
  onSubmit,
  onCancel,
}: PasswordPromptDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const formRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setValue('');
    setRevealed(false);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelRef.current();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value) {
      return;
    }
    onSubmit(value);
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-black/40"
        style={{ zIndex: zIndexBase - 10 }}
        onClick={onCancel}
        aria-label={t('sidepanel_action_cancel', 'Cancel')}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: zIndexBase }}>
        <form
          ref={formRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl"
        >
          <h3
            id={titleId}
            className="flex items-center gap-2 text-sm font-semibold text-card-foreground"
          >
            <Lock className="h-3.5 w-3.5" />
            {title}
          </h3>
          <p id={messageId} className="mt-2 text-xs text-muted-foreground">
            {message}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              ref={inputRef}
              className="input h-8 flex-1 text-xs"
              type={revealed ? 'text' : 'password'}
              autoComplete="new-password"
              spellCheck={false}
              value={value}
              placeholder={placeholder || t('sidepanel_settings_vault_prompt_placeholder', 'Vault password')}
              onChange={(event) => setValue(event.target.value)}
            />
            <button
              type="button"
              className="btn-icon h-8 w-8"
              onClick={() => setRevealed((prev) => !prev)}
              aria-label={
                revealed
                  ? t('sidepanel_settings_vault_viewer_hide', 'Hide')
                  : t('sidepanel_settings_vault_viewer_show', 'Show')
              }
              title={
                revealed
                  ? t('sidepanel_settings_vault_viewer_hide', 'Hide')
                  : t('sidepanel_settings_vault_viewer_show', 'Show')
              }
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" className="btn-ghost h-8 gap-1 px-3 text-xs" onClick={onCancel}>
              <X className="h-3.5 w-3.5" />
              {cancelLabel || t('sidepanel_action_cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary h-8 gap-1 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!value}
            >
              <Check className="h-3.5 w-3.5" />
              {submitLabel || t('sidepanel_settings_vault_prompt_submit', 'Continue')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
