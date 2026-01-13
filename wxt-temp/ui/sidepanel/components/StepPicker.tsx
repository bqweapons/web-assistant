import { useEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { STEP_LIBRARY } from './stepLibrary';

type StepPickerProps = {
  onPick: (type: string) => void;
  ariaLabel: string;
  buttonRef?: Ref<HTMLButtonElement>;
};

export default function StepPicker({ onPick, ariaLabel, buttonRef }: StepPickerProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (pickerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
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

  useEffect(() => {
    if (!open) {
      return;
    }
    setMenuPosition(null);
    let rafId = 0;
    const picker = pickerRef.current;
    const menu = menuRef.current;
    if (!picker || !menu) {
      return;
    }
    const gap = 8;
    const updatePosition = () => {
      if (!pickerRef.current || !menuRef.current) {
        return;
      }
      const pickerRect = pickerRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();
      const availableAbove = pickerRect.top;
      const availableBelow = window.innerHeight - pickerRect.bottom;
      const nextPlacement =
        availableAbove < menuRect.height + gap && availableBelow > availableAbove ? 'bottom' : 'top';
      const rawLeft = pickerRect.right - menuRect.width;
      const maxLeft = window.innerWidth - menuRect.width - gap;
      const left = Math.min(Math.max(rawLeft, gap), maxLeft);
      const top =
        nextPlacement === 'top'
          ? Math.max(gap, pickerRect.top - menuRect.height - gap)
          : Math.min(window.innerHeight - menuRect.height - gap, pickerRect.bottom + gap);
      setMenuPosition({ top, left });
    };
    rafId = window.requestAnimationFrame(updatePosition);
    const handleResize = () => updatePosition();
    const scrollContainer = picker.closest('[data-step-scroll]');
    const handleScroll = () => setOpen(false);
    window.addEventListener('resize', handleResize);
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      scrollContainer?.removeEventListener('scroll', handleScroll);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      data-step-picker-menu
      className={`fixed z-50 w-64 rounded border border-border bg-card p-2 shadow-md ${
        menuPosition ? '' : 'pointer-events-none opacity-0'
      }`}
      style={{ top: menuPosition?.top ?? 0, left: menuPosition?.left ?? 0 }}
    >
      <div className="flex flex-col gap-1">
        {STEP_LIBRARY.map((item) => (
          <button
            key={item.type}
            type="button"
            className="rounded px-2 py-2 text-left transition hover:bg-muted focus-visible:bg-muted"
            onClick={() => {
              onPick(item.type);
              setOpen(false);
            }}
          >
            <div className="text-xs font-semibold text-foreground">{item.label}</div>
            <div className="text-[11px] text-muted-foreground">{item.description}</div>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div ref={pickerRef} className="relative" data-step-picker>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={ariaLabel}
        ref={buttonRef}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Plus className="h-4 w-4" />
      </button>
      {open && typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
  );
}
