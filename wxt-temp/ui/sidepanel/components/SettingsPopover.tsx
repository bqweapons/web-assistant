import type { SettingsPopoverProps } from '../types';

export default function SettingsPopover({ open, onClose, children }: SettingsPopoverProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div className="absolute right-4 top-16 w-[min(360px,calc(100%-2rem))] max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        {children}
      </div>
    </div>
  );
}
