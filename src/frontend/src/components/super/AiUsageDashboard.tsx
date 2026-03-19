import { BarChart3 } from 'lucide-react';
import { useState, useMemo } from 'react';

import AiUsageActionGrid from './AiUsageActionGrid';
import AiUsageChart from './AiUsageChart';
import AiUsageDateFilter, { getDateRange, type DatePreset } from './AiUsageDateFilter';
import AiUsageLogGrid from './AiUsageLogGrid';
import AiUsageSummaryCards from './AiUsageSummaryCards';

import { Skeleton } from '@/components/ui/skeleton';
import { useAiUsageStats } from '@/hooks/useAiUsage';
import type { AiUsageFilterParams } from '@/services/api/aiUsageService';

export default function AiUsageDashboard() {
  const [preset, setPreset] = useState<DatePreset>('30d');

  const dateRange = useMemo(() => getDateRange(preset), [preset]);

  const filters = useMemo<AiUsageFilterParams>(
    () => ({
      ...dateRange,
    }),
    [dateRange]
  );

  const { data: stats, isLoading } = useAiUsageStats(filters);

  const header = (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
          AI Usage Analytics
        </h3>
        <p className="text-xs text-foreground-muted mt-1">
          Token consumption, cost breakdown, and usage trends across all AI operations.
        </p>
      </div>
      <AiUsageDateFilter value={preset} onChange={setPreset} />
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!stats || stats.totals.totalRequests === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-12 flex flex-col items-center gap-3 text-center">
          <BarChart3 className="size-10 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No AI usage data yet for this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <AiUsageSummaryCards stats={stats} />
      <AiUsageActionGrid items={stats.byActionType} />
      <AiUsageChart byModel={stats.byModel} />
      <AiUsageLogGrid filters={filters} />
    </div>
  );
}
