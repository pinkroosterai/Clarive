import { AllCommunityModule, type ColDef, type SortChangedEvent } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { format } from 'date-fns';
import { Check, ChevronsUpDown, Download, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import SystemLogDetailPanel from '@/components/super/SystemLogDetailPanel';
import { agGridTheme } from '@/lib/agGridTheme';
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
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSystemLogs } from '@/hooks/useSystemLogs';
import { cn } from '@/lib/utils';
import type { SystemLogEntry, SystemLogFilterParams } from '@/services/api/systemLogService';

// ── Level options ──

const LEVEL_OPTIONS = [
  { value: 'Verbose', label: 'Verbose' },
  { value: 'Debug', label: 'Debug' },
  { value: 'Information', label: 'Information' },
  { value: 'Warning', label: 'Warning' },
  { value: 'Error', label: 'Error' },
  { value: 'Fatal', label: 'Fatal' },
];

const levelBadgeClass: Record<string, string> = {
  Verbose: 'bg-muted text-foreground-muted',
  Debug: 'bg-muted text-foreground-muted',
  Information: 'bg-primary/10 text-primary',
  Warning: 'bg-warning-bg text-warning-text border-warning-border',
  Error: 'bg-error-bg text-error-text border-error-border',
  Fatal: 'bg-error-bg text-error-text border-error-border font-bold',
};

// ── Multi-select filter dropdown (same pattern as AiUsageLogGrid) ──

interface MultiSelectFilterProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') clear(e as unknown as React.MouseEvent);
                }}
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
                    <Check
                      className={cn('mr-2 size-4', isSelected ? 'opacity-100' : 'opacity-0')}
                    />
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

export default function SystemLogGrid() {
  const gridRef = useRef<AgGridReact<SystemLogEntry>>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<string | undefined>('timestamp');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedRow, setSelectedRow] = useState<SystemLogEntry | null>(null);

  // Filters
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const filters = useMemo<SystemLogFilterParams>(
    () => ({
      levels: selectedLevels.length > 0 ? selectedLevels : undefined,
      search: debouncedSearch || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [selectedLevels, debouncedSearch, dateFrom, dateTo]
  );

  const { data, isLoading } = useSystemLogs(filters, page, pageSize, sortBy, sortDesc);

  const logs = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleLevelsChange = useCallback((values: string[]) => {
    setSelectedLevels(values);
    setPage(1);
  }, []);

  const columnDefs = useMemo<ColDef<SystemLogEntry>[]>(
    () => [
      {
        field: 'timestamp',
        headerName: 'Timestamp',
        sortable: true,
        sort: 'desc',
        width: 180,
        valueFormatter: (p) => (p.value ? format(new Date(p.value), 'MMM d, yyyy HH:mm:ss') : ''),
      },
      {
        field: 'level',
        headerName: 'Level',
        sortable: true,
        width: 120,
        cellRenderer: (p: { value: string }) => {
          const cls = levelBadgeClass[p.value] ?? 'bg-muted text-foreground-muted';
          return (
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}
            >
              {p.value}
            </span>
          );
        },
      },
      {
        field: 'sourceContext',
        headerName: 'Source',
        sortable: false,
        width: 220,
        valueFormatter: (p) => {
          if (!p.value) return '—';
          // Show class name only (last segment of namespace)
          const parts = (p.value as string).split('.');
          return parts[parts.length - 1];
        },
        tooltipValueGetter: (p) => p.value ?? '',
      },
      {
        field: 'message',
        headerName: 'Message',
        sortable: false,
        flex: 1,
        minWidth: 300,
        cellStyle: {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      },
    ],
    []
  );

  const onSortChanged = useCallback((event: SortChangedEvent<SystemLogEntry>) => {
    const sortModel = event.api.getColumnState().find((c) => c.sort != null);
    if (sortModel) {
      const fieldMap: Record<string, string> = {
        timestamp: 'timestamp',
        level: 'level',
        message: 'message',
      };
      setSortBy(fieldMap[sortModel.colId] ?? 'timestamp');
      setSortDesc(sortModel.sort === 'desc');
    } else {
      setSortBy('timestamp');
      setSortDesc(true);
    }
    setPage(1);
  }, []);

  const handleExportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({
      fileName: `system-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`,
    });
  }, []);

  const handleDetailClose = useCallback(() => setSelectedRow(null), []);

  const hasActiveFilters = selectedLevels.length > 0 || !!debouncedSearch || !!dateFrom || !!dateTo;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">
            {totalCount.toLocaleString()} log{totalCount !== 1 ? 's' : ''} total
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
      <div className="flex items-center gap-2 flex-wrap">
        <MultiSelectFilter
          label="Level"
          options={LEVEL_OPTIONS}
          selected={selectedLevels}
          onChange={handleLevelsChange}
        />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-foreground-muted" />
          <Input
            placeholder="Search messages..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="h-8 w-[200px] pl-7 text-xs"
          />
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="h-8 w-[140px] text-xs"
          placeholder="From"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="h-8 w-[140px] text-xs"
          placeholder="To"
        />
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-foreground-muted"
            onClick={() => {
              setSelectedLevels([]);
              setSearchText('');
              setDateFrom('');
              setDateTo('');
              setPage(1);
            }}
          >
            <X className="size-3 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="ag-theme-quartz rounded-md border" style={{ height: 'min(500px, calc(100vh - 300px))' }}>
        <AgGridReact<SystemLogEntry>
          ref={gridRef}
          theme={agGridTheme}
          modules={[AllCommunityModule]}
          rowData={logs}
          columnDefs={columnDefs}
          loading={isLoading}
          suppressMovableColumns
          suppressCellFocus
          animateRows={false}
          onSortChanged={onSortChanged}
          onRowClicked={(e) =>
            setSelectedRow((prev) => (prev?.id === e.data?.id ? null : (e.data ?? null)))
          }
          getRowClass={(params) =>
            params.data?.id === selectedRow?.id ? 'ag-row-selected' : undefined
          }
        />
      </div>

      {/* Detail Panel */}
      {selectedRow && <SystemLogDetailPanel row={selectedRow} onClose={handleDetailClose} />}

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
