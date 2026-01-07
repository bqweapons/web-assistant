import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export default function Card({ children, className = '', onClick }: CardProps) {
  const isInteractive = Boolean(onClick);
  const interactiveClasses = isInteractive
    ? 'cursor-pointer transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
    : '';

  return (
    <div
      className={`min-w-0 rounded border border-border bg-card text-card-foreground p-4 shadow-sm ${interactiveClasses} ${className}`.trim()}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
