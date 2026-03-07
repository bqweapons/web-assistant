import type { ReactNode } from 'react';

type SegmentedTabOption = {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  tone?: 'default' | 'warning';
};

type SegmentedTabsProps = {
  value: string;
  options: SegmentedTabOption[];
  onChange: (value: string) => void;
  className?: string;
};

const getInactiveToneClassName = (tone: SegmentedTabOption['tone']) => {
  if (tone === 'warning') {
    return 'border-amber-400/50 bg-amber-100/40 text-amber-900 hover:bg-amber-100/50';
  }
  return 'border-border/70 bg-card text-muted-foreground hover:bg-muted/50';
};

export default function SegmentedTabs({
  value,
  options,
  onChange,
  className = '',
}: SegmentedTabsProps) {
  return (
    <div
      className={`grid gap-2 ${className}`.trim()}
      style={{ gridTemplateColumns: `repeat(${Math.max(1, options.length)}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`inline-flex h-6 w-full cursor-pointer items-center justify-center gap-2 rounded border px-3 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              active
                ? 'border-primary/45 bg-primary/10 text-foreground shadow-sm'
                : getInactiveToneClassName(option.tone)
            }`}
            onClick={() => onChange(option.value)}
            disabled={option.disabled}
          >
            {option.icon ? option.icon : null}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
