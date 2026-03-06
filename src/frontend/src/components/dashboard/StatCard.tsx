import type { LucideIcon } from 'lucide-react';
import { memo } from 'react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
}

export const StatCard = memo(function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-4 flex items-center gap-4">
      <div className="rounded-md bg-primary/10 p-2.5">
        <Icon className="size-5 text-primary" />
      </div>
      <div>
        <div className="text-2xl font-bold text-foreground tabular-nums">
          {value.toLocaleString()}
        </div>
        <div className="text-sm text-foreground-muted">{label}</div>
      </div>
    </div>
  );
});
