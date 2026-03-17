import { BarChart3 } from 'lucide-react';
import { useState, useMemo } from 'react';

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <Skeleton className="h-8 w-40" />
        </div>
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
        <div className="flex items-center justify-end">
          <AiUsageDateFilter value={preset} onChange={setPreset} />
        </div>
        <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-12 flex flex-col items-center gap-3 text-center">
          <BarChart3 className="size-10 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No AI usage data yet for this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <AiUsageDateFilter value={preset} onChange={setPreset} />
      </div>
      <AiUsageSummaryCards stats={stats} />
      <AiUsageChart byModel={stats.byModel} />
      <AiUsageLogGrid filters={filters} />
    </div>
  );
}
