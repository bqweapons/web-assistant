import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type SelectOption = {
  value: string;
  label: string;
  rightLabel?: string;
  disabled?: boolean;
};

type SelectMenuProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  iconPosition?: 'left' | 'right';
};

export default function SelectMenu({
  value,
  options,
  onChange,
  placeholder = 'Select',
  iconPosition = 'right',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);
  const label = selected?.label || placeholder;

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="input flex items-center gap-2 text-left cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {iconPosition === 'left' ? (
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        ) : null}
        <span className="flex-1 truncate">{label}</span>
        {iconPosition === 'right' ? (
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        ) : null}
      </button>
      {open ? (
        <div className="absolute left-0 right-0 z-10 mt-2 rounded border border-border bg-card p-2 shadow-md">
          <div className="flex flex-col gap-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`flex items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm transition ${
                  option.disabled
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer text-card-foreground hover:bg-muted focus-visible:bg-muted'
                }`}
                onClick={() => {
                  if (option.disabled) {
                    return;
                  }
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="truncate">{option.label}</span>
                {option.rightLabel ? (
                  <span className="text-xs text-muted-foreground">{option.rightLabel}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
