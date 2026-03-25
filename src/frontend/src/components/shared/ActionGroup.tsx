import type { ReactNode } from 'react';

export function ActionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
        {label}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
