import type { StatCardProps } from '../types';
import Card from './Card';

export default function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <p className="min-h-[1.25rem] truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-3xl font-semibold leading-none tabular-nums text-card-foreground">{value}</p>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </Card>
  );
}



