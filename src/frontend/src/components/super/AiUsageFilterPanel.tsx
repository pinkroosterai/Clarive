import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MultiSelectFilter } from '@/components/super/MultiSelectFilter';
import { useAiUsageFilters } from '@/hooks/useAiUsage';

export interface MultiFilters {
  models: string[];
  actionTypes: string[];
  tenantIds: string[];
}

interface AiUsageFilterPanelProps {
  filters: MultiFilters;
  onFiltersChange: (filters: MultiFilters) => void;
  dateFrom?: string;
  dateTo?: string;
}

export function AiUsageFilterPanel({ filters, onFiltersChange, dateFrom, dateTo }: AiUsageFilterPanelProps) {
  const { data: options } = useAiUsageFilters(dateFrom, dateTo);

  const hasAnyFilter = filters.models.length > 0 || filters.actionTypes.length > 0 || filters.tenantIds.length > 0;

  const actionTypeOptions = (options?.actionTypes ?? []).map((a) => ({ value: a, label: a }));
  const modelOptions = (options?.models ?? []).map((m) => ({ value: m.id, label: m.displayName }));
  const tenantOptions = (options?.tenants ?? []).map((t) => ({ value: t.id, label: t.name }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectFilter
        label="Action Type"
        options={actionTypeOptions}
        selected={filters.actionTypes}
        onChange={(actionTypes) => onFiltersChange({ ...filters, actionTypes })}
      />
      <MultiSelectFilter
        label="Model"
        options={modelOptions}
        selected={filters.models}
        onChange={(models) => onFiltersChange({ ...filters, models })}
      />
      <MultiSelectFilter
        label="Tenant"
        options={tenantOptions}
        selected={filters.tenantIds}
        onChange={(tenantIds) => onFiltersChange({ ...filters, tenantIds })}
      />
      {hasAnyFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onFiltersChange({ models: [], actionTypes: [], tenantIds: [] })}
        >
          <X className="mr-1 h-3 w-3" />
          Clear all
        </Button>
      )}
    </div>
  );
}
