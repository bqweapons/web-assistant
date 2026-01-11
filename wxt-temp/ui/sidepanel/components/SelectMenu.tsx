import { useEffect, useRef, useState } from 'react';
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
  useInputStyle?: boolean;
  buttonClassName?: string;
  menuClassName?: string;
  centerLabel?: boolean;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export default function SelectMenu({
  value,
  options,
  onChange,
  placeholder = 'Select',
  iconPosition = 'right',
  useInputStyle = true,
  buttonClassName = '',
  menuClassName = '',
  centerLabel = false,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((option) => option.value === value);
  const label = selected?.label || placeholder;

  const closeMenu = () => setOpen(false);
  const toggleMenu = () => setOpen((prev) => !prev);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
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

  const iconClassName = cx('h-4 w-4 transition', open && 'rotate-180');
  const triggerClassName = cx(
    useInputStyle && 'input',
    'flex items-center gap-2 cursor-pointer',
    centerLabel ? 'justify-center text-center' : 'text-left',
    buttonClassName,
  );
  const menuClasses = cx(
    'absolute left-0 right-0 z-10 mt-2 rounded border border-border bg-card p-2 shadow-md',
    menuClassName,
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleMenu}
      >
        {iconPosition === 'left' ? <ChevronDown className={iconClassName} /> : null}
        <span className={centerLabel ? 'truncate' : 'flex-1 truncate'}>{label}</span>
        {iconPosition === 'right' ? <ChevronDown className={iconClassName} /> : null}
      </button>
      {open ? (
        <div className={menuClasses} role="listbox">
          <div className="flex flex-col gap-1">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cx(
                    'flex items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm transition',
                    option.disabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer text-card-foreground hover:bg-muted focus-visible:bg-muted',
                    isSelected && !option.disabled && 'bg-muted',
                  )}
                  onClick={() => {
                    if (option.disabled) {
                      return;
                    }
                    onChange(option.value);
                    closeMenu();
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {option.rightLabel ? (
                    <span className="text-xs text-muted-foreground">{option.rightLabel}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
