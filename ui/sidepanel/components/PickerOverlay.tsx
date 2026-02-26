type PickerOverlayProps = {
  title: string;
  hint: string;
  error?: string;
  cancelLabel?: string;
  onCancel?: () => void;
};

export default function PickerOverlay({
  title,
  hint,
  error,
  cancelLabel,
  onCancel,
}: PickerOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
        {onCancel && cancelLabel ? (
          <button type="button" className="btn-ghost mt-3 h-8 px-3 text-xs" onClick={onCancel}>
            {cancelLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
