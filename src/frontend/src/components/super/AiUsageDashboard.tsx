import { useState, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiUsageStats } from '@/hooks/useAiUsage';
import type { AiUsageFilterParams } from '@/services/api/aiUsageService';
import AiUsageDateFilter, { getDateRange, type DatePreset } from './AiUsageDateFilter';
import { AiUsageFilterPanel, type MultiFilters } from './AiUsageFilterPanel';
import AiUsageSummaryCards from './AiUsageSummaryCards';
import AiUsageChart from './AiUsageChart';
import AiUsageBreakdownTables from './AiUsageBreakdownTables';

const emptyMultiFilters: MultiFilters = { models: [], actionTypes: [], tenantIds: [] };

export default function AiUsageDashboard() {
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [multiFilters, setMultiFilters] = useState<MultiFilters>(emptyMultiFilters);

  const dateRange = useMemo(() => getDateRange(preset), [preset]);

  const filters = useMemo<AiUsageFilterParams>(() => ({
    ...dateRange,
    models: multiFilters.models.length > 0 ? multiFilters.models : undefined,
    actionTypes: multiFilters.actionTypes.length > 0 ? multiFilters.actionTypes : undefined,
    tenantIds: multiFilters.tenantIds.length > 0 ? multiFilters.tenantIds : undefined,
  }), [dateRange, multiFilters]);

  const { data: stats, isLoading } = useAiUsageStats(filters);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AiUsageFilterPanel
            filters={multiFilters}
            onFiltersChange={setMultiFilters}
            dateFrom={dateRange.dateFrom}
            dateTo={dateRange.dateTo}
          />
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AiUsageFilterPanel
          filters={multiFilters}
          onFiltersChange={setMultiFilters}
          dateFrom={dateRange.dateFrom}
          dateTo={dateRange.dateTo}
        />
        <AiUsageDateFilter value={preset} onChange={setPreset} />
      </div>
      <AiUsageSummaryCards stats={stats} />
      <AiUsageChart byModel={stats.byModel} />
      <AiUsageBreakdownTables stats={stats} />
    </div>
  );
}
