import {
  AllCommunityModule,
  type ColDef,
  type SortChangedEvent,
  themeQuartz,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { format } from 'date-fns';
import { Check, ChevronsUpDown, Download, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import AiUsageLogDetailPanel from '@/components/super/AiUsageLogDetailPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useAiUsageFilters, useAiUsageLogs } from '@/hooks/useAiUsage';
import type { AiUsageFilterParams, AiUsageLogEntry } from '@/services/api/aiUsageService';

interface AiUsageLogGridProps {
  filters: AiUsageFilterParams;
}

const formatCurrency = (value: number | null): string => {
  if (value == null || value === 0) return '—';
  return `$${value.toFixed(4)}`;
};

const formatNumber = (value: number): string => value.toLocaleString();

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// ── Multi-select filter dropdown ──

interface MultiSelectFilterProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <ChevronsUpDown className="size-3" />
          {label}
          {selected.length > 0 && (
            <>
              <Badge variant="secondary" className="px-1 py-0 text-xs font-normal">
                {selected.length}
              </Badge>
              <span
                role="button"
                tabIndex={0}
                onClick={clear}
                onKeyDown={(e) => { if (e.key === 'Enter') clear(e as unknown as React.MouseEvent); }}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="size-3" />
              </span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <CommandItem key={opt.value} value={opt.label} onSelect={() => toggle(opt.value)}>
                    <Check className={cn('mr-2 size-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Main Component ──

export default function AiUsageLogGrid({ filters }: AiUsageLogGridProps) {
  const gridRef = useRef<AgGridReact<AiUsageLogEntry>>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<string | undefined>('createdAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedRow, setSelectedRow] = useState<AiUsageLogEntry | null>(null);

  // Server-side column filters
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([]);

  // Fetch available filter options from backend
  const { data: filterOptions } = useAiUsageFilters(filters.dateFrom, filters.dateTo);

  // Build select options from filter API response
  const modelOptions = useMemo(
    () => (filterOptions?.models ?? []).map((m) => ({ value: m.id, label: m.displayName })),
    [filterOptions],
  );
  const actionTypeOptions = useMemo(
    () => (filterOptions?.actionTypes ?? []).map((a) => ({ value: a, label: a })),
    [filterOptions],
  );

  // Merge parent filters with column filters
  const mergedFilters = useMemo<AiUsageFilterParams>(
    () => ({
      ...filters,
      models: selectedModels.length > 0 ? selectedModels : undefined,
      actionTypes: selectedActionTypes.length > 0 ? selectedActionTypes : undefined,
    }),
    [filters, selectedModels, selectedActionTypes],
  );

  const { data, isLoading } = useAiUsageLogs(mergedFilters, page, pageSize, sortBy, sortDesc);

  const logs = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleModelsChange = useCallback((values: string[]) => {
    setSelectedModels(values);
    setPage(1);
  }, []);

  const handleActionTypesChange = useCallback((values: string[]) => {
    setSelectedActionTypes(values);
    setPage(1);
  }, []);

  const columnDefs = useMemo<ColDef<AiUsageLogEntry>[]>(
    () => [
      {
        field: 'createdAt',
        headerName: 'Timestamp',
        sortable: true,
        sort: 'desc',
        width: 170,
        valueFormatter: (p) => (p.value ? format(new Date(p.value), 'MMM d, yyyy HH:mm:ss') : ''),
      },
      {
        field: 'userEmail',
        headerName: 'User',
        sortable: false,
        width: 180,
        filter: 'agTextColumnFilter',
        valueFormatter: (p) => p.value ?? '—',
      },
      {
        field: 'tenantName',
        headerName: 'Tenant',
        sortable: false,
        width: 140,
        filter: 'agTextColumnFilter',
        valueFormatter: (p) => p.value ?? '—',
      },
      {
        field: 'displayModel',
        headerName: 'Model',
        sortable: true,
        width: 200,
      },
      {
        field: 'actionType',
        headerName: 'Action',
        sortable: true,
        width: 130,
      },
      {
        field: 'inputTokens',
        headerName: 'In Tokens',
        sortable: true,
        width: 110,
        type: 'rightAligned',
        filter: 'agNumberColumnFilter',
        filterParams: {
          filterOptions: ['inRange', 'greaterThan', 'lessThan', 'equals'],
          defaultOption: 'inRange',
        },
        valueFormatter: (p) => formatNumber(p.value),
      },
      {
        field: 'outputTokens',
        headerName: 'Out Tokens',
        sortable: true,
        width: 110,
        type: 'rightAligned',
        filter: 'agNumberColumnFilter',
        filterParams: {
          filterOptions: ['inRange', 'greaterThan', 'lessThan', 'equals'],
          defaultOption: 'inRange',
        },
        valueFormatter: (p) => formatNumber(p.value),
      },
      {
        field: 'estimatedInputCostUsd',
        headerName: 'In Cost',
        sortable: true,
        width: 100,
        type: 'rightAligned',
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        field: 'estimatedOutputCostUsd',
        headerName: 'Out Cost',
        sortable: true,
        width: 100,
        type: 'rightAligned',
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: 'Total Cost',
        sortable: false,
        width: 100,
        type: 'rightAligned',
        valueGetter: (p) =>
          (p.data?.estimatedInputCostUsd ?? 0) + (p.data?.estimatedOutputCostUsd ?? 0),
        valueFormatter: (p) => formatCurrency(p.value as number),
      },
      {
        field: 'durationMs',
        headerName: 'Duration',
        sortable: true,
        width: 100,
        type: 'rightAligned',
        filter: 'agNumberColumnFilter',
        filterParams: {
          filterOptions: ['inRange', 'greaterThan', 'lessThan', 'equals'],
          defaultOption: 'inRange',
        },
        valueFormatter: (p) => formatDuration(p.value),
      },
    ],
    [],
  );

  const onSortChanged = useCallback((event: SortChangedEvent<AiUsageLogEntry>) => {
    const sortModel = event.api.getColumnState().find((c) => c.sort != null);
    if (sortModel) {
      const fieldMap: Record<string, string> = {
        createdAt: 'createdAt',
        displayModel: 'model',
        actionType: 'actionType',
        inputTokens: 'inputTokens',
        outputTokens: 'outputTokens',
        estimatedInputCostUsd: 'estimatedInputCostUsd',
        estimatedOutputCostUsd: 'estimatedOutputCostUsd',
        durationMs: 'durationMs',
      };
      setSortBy(fieldMap[sortModel.colId] ?? 'createdAt');
      setSortDesc(sortModel.sort === 'desc');
    } else {
      setSortBy('createdAt');
      setSortDesc(true);
    }
    setPage(1);
  }, []);

  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `ai-usage-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    });
  }, []);

  const handleDetailClose = useCallback(() => setSelectedRow(null), []);

  const hasActiveFilters = selectedModels.length > 0 || selectedActionTypes.length > 0;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">
            {totalCount.toLocaleString()} request{totalCount !== 1 ? 's' : ''} total
          </span>
          {hasActiveFilters && (
            <Badge variant="outline" className="text-xs font-normal text-primary">
              Filtered
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={logs.length === 0}>
          <Download className="size-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <MultiSelectFilter
          label="Model"
          options={modelOptions}
          selected={selectedModels}
          onChange={handleModelsChange}
        />
        <MultiSelectFilter
          label="Action"
          options={actionTypeOptions}
          selected={selectedActionTypes}
          onChange={handleActionTypesChange}
        />
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-foreground-muted"
            onClick={() => {
              setSelectedModels([]);
              setSelectedActionTypes([]);
              setPage(1);
            }}
          >
            <X className="size-3 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="ag-theme-quartz rounded-md border" style={{ height: 500 }}>
        <AgGridReact<AiUsageLogEntry>
          ref={gridRef}
          theme={themeQuartz}
          modules={[AllCommunityModule]}
          rowData={logs}
          columnDefs={columnDefs}
          loading={isLoading}
          suppressMovableColumns
          suppressCellFocus
          animateRows={false}
          onSortChanged={onSortChanged}
          onRowClicked={(e) =>
            setSelectedRow((prev) => (prev?.id === e.data?.id ? null : e.data ?? null))
          }
          getRowClass={(params) =>
            params.data?.id === selectedRow?.id ? 'ag-row-selected' : undefined
          }
        />
      </div>

      {/* Detail Panel */}
      {selectedRow && <AiUsageLogDetailPanel row={selectedRow} onClose={handleDetailClose} />}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-foreground-muted">
          Showing {logs.length > 0 ? (page - 1) * pageSize + 1 : 0}–
          {Math.min(page * pageSize, totalCount)} of {totalCount.toLocaleString()}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground-muted">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="px-2 text-sm text-foreground-muted">
              {page} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
