import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { t } from '../utils/i18n';

export type SelectOption = {
  value: string;
  label: string;
  rightLabel?: string;
  disabled?: boolean;
  sticky?: boolean;
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
  placeholder = t('sidepanel_select_placeholder', 'Select'),
  iconPosition = 'right',
  useInputStyle = true,
  buttonClassName = '',
  menuClassName = '',
  centerLabel = false,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((option) => option.value === value);
  const label = selected?.label || placeholder;

  const closeMenu = () => setOpen(false);
  const toggleMenu = () => setOpen((prev) => !prev);

  useEffect(() => {
    if (!open) {
      setOpenUpward(false);
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

  useEffect(() => {
    if (!open) {
      return;
    }
    const findScrollParent = (node: HTMLElement | null) => {
      let current = node?.parentElement || null;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (
          /(auto|scroll)/.test(style.overflowY) ||
          /(auto|scroll)/.test(style.overflow)
        ) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };
    const container = containerRef.current;
    const scrollParent = findScrollParent(container);
    let frameId = 0;
    const updateMenuPosition = () => {
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const boundaryRect = scrollParent?.getBoundingClientRect() ?? {
        top: 0,
        bottom: window.innerHeight,
      };
      const spaceBelow = boundaryRect.bottom - rect.bottom;
      const spaceAbove = rect.top - boundaryRect.top;
      const menuHeight =
        menuRef.current?.getBoundingClientRect().height ??
        Math.min((boundaryRect.bottom - boundaryRect.top) * 0.6, 320);
      const shouldOpenUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;
      setOpenUpward(shouldOpenUpward);
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateMenuPosition);
    };
    scheduleUpdate();
    const scrollTarget: Window | HTMLElement = scrollParent ?? window;
    scrollTarget.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frameId);
      scrollTarget.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
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
    'absolute left-0 right-auto z-10 max-h-[30vh] min-w-full w-max overflow-y-auto rounded border border-border bg-card p-2 shadow-md',
    openUpward ? 'bottom-full mb-2' : 'mt-2',
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
        <div ref={menuRef} className={menuClasses} role="listbox">
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
                    option.sticky && 'sticky top-[-10px] z-10 -mx-2 rounded-none border-b border-border bg-card px-5',
                    option.disabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'cursor-pointer text-card-foreground hover:bg-muted focus-visible:bg-muted',
                    isSelected && !option.disabled && 'bg-muted',
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
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
