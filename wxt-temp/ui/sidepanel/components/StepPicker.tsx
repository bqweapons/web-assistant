import { useEffect, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search } from 'lucide-react';
import { STEP_LIBRARY } from './stepLibrary';
import { t } from '../utils/i18n';

type StepPickerProps = {
  onPick: (type: string) => void;
  ariaLabel: string;
  buttonRef?: Ref<HTMLButtonElement>;
};

export default function StepPicker({ onPick, ariaLabel, buttonRef }: StepPickerProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [query, setQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
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

  const normalizedQuery = query.trim().toLowerCase();
  const filteredLibrary = normalizedQuery
    ? STEP_LIBRARY.filter((item) => {
        const haystack = `${item.label} ${item.description}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : STEP_LIBRARY;

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
      <div className="mb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input h-8 pl-7 text-xs"
            placeholder={t('sidepanel_steps_search_placeholder', 'Search steps')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {filteredLibrary.length === 0 ? (
          <div className="rounded px-2 py-2 text-[11px] text-muted-foreground">
            {t('sidepanel_steps_search_empty', 'No steps found.')}
          </div>
        ) : (
          filteredLibrary.map((item) => (
            <button
              key={item.type}
              type="button"
              className="rounded px-2 py-2 text-left transition hover:bg-muted focus-visible:bg-muted"
              onClick={() => {
                onPick(item.type);
                setOpen(false);
              }}
            >
              <div className="text-xs font-semibold text-foreground">
                {t(item.labelKey, item.label)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {t(item.descriptionKey, item.description)}
              </div>
            </button>
          ))
        )}
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
