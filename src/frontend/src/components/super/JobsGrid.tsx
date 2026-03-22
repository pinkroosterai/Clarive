import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AllCommunityModule, type ColDef, type ICellRendererParams } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Check, Pause, Play, RotateCw, X } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { agGridTheme } from '@/lib/agGridTheme';
import {
  getJobs,
  getJobHistory,
  triggerJob,
  pauseJob,
  resumeJob,
  type JobSummary,
  type JobHistoryItem,
} from '@/services/api/jobService';

// ── Cell Renderers ──

function StatusCell({ value }: ICellRendererParams<JobSummary, string>) {
  if (!value) return null;
  const variant =
    value === 'Normal'
      ? 'default'
      : value === 'Paused'
        ? 'secondary'
        : value === 'Blocked' || value === 'Error'
          ? 'destructive'
          : 'outline';
  return <Badge variant={variant}>{value}</Badge>;
}

function LastRunCell({ value }: ICellRendererParams<JobSummary, string | null>) {
  if (!value) return <span className="text-foreground-muted">Never</span>;
  return (
    <span title={format(new Date(value), 'PPpp')}>
      {formatDistanceToNow(new Date(value), { addSuffix: true })}
    </span>
  );
}

function NextFireCell({ value }: ICellRendererParams<JobSummary, string | null>) {
  if (!value) return <span className="text-foreground-muted">N/A</span>;
  return (
    <span title={format(new Date(value), 'PPpp')}>
      {formatDistanceToNow(new Date(value), { addSuffix: true })}
    </span>
  );
}

function DurationCell({ value }: ICellRendererParams<JobSummary, number | null>) {
  if (value == null) return <span className="text-foreground-muted">—</span>;
  if (value < 1000) return <span>{value}ms</span>;
  return <span>{(value / 1000).toFixed(1)}s</span>;
}

function ResultCell({ value }: ICellRendererParams<JobSummary, boolean | null>) {
  if (value == null) return <span className="text-foreground-muted">—</span>;
  return value ? (
    <Check className="size-4 text-green-600" />
  ) : (
    <X className="size-4 text-red-500" />
  );
}

// ── History Panel (expandable row detail) ──

function HistoryPanel({ jobName }: { jobName: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['super', 'jobs', jobName, 'history', page],
    queryFn: () => getJobHistory(jobName, page, 10),
  });

  if (isLoading) return <div className="p-4 text-sm text-foreground-muted">Loading history...</div>;
  if (!data || data.items.length === 0)
    return <div className="p-4 text-sm text-foreground-muted">No execution history yet.</div>;

  const totalPages = Math.ceil(data.totalCount / 10);

  return (
    <div className="p-4 space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-foreground-muted border-b">
            <th className="pb-2 font-medium">Fire Time</th>
            <th className="pb-2 font-medium">Duration</th>
            <th className="pb-2 font-medium">Result</th>
            <th className="pb-2 font-medium">Error</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item: JobHistoryItem, idx: number) => (
            <tr key={idx} className="border-b border-border-subtle last:border-0">
              <td className="py-2">{format(new Date(item.fireTimeUtc), 'PPpp')}</td>
              <td className="py-2">
                {item.durationMs != null
                  ? item.durationMs < 1000
                    ? `${item.durationMs}ms`
                    : `${(item.durationMs / 1000).toFixed(1)}s`
                  : '—'}
              </td>
              <td className="py-2">
                {item.succeeded ? (
                  <Badge variant="default">OK</Badge>
                ) : (
                  <Badge variant="destructive">Failed</Badge>
                )}
              </td>
              <td className="py-2 max-w-xs truncate text-foreground-muted">
                {item.exceptionMessage || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </Button>
          <span className="text-xs text-foreground-muted">
            {page} / {totalPages}
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
      )}
    </div>
  );
}

// ── Main Grid ──

export default function JobsGrid() {
  const gridRef = useRef<AgGridReact<JobSummary>>(null);
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<JobSummary | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['super', 'jobs'],
    queryFn: getJobs,
    refetchInterval: 30_000,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['super', 'jobs'] }),
    [queryClient]
  );

  const triggerMutation = useMutation({ mutationFn: triggerJob, onSuccess: invalidate });
  const pauseMutation = useMutation({ mutationFn: pauseJob, onSuccess: invalidate });
  const resumeMutation = useMutation({ mutationFn: resumeJob, onSuccess: invalidate });

  const columnDefs = useMemo<ColDef<JobSummary>[]>(
    () => [
      { field: 'name', headerName: 'Name', flex: 2, minWidth: 140 },
      { field: 'group', headerName: 'Group', flex: 1, minWidth: 100 },
      { field: 'cronExpression', headerName: 'Cron', flex: 1.5, minWidth: 120 },
      {
        field: 'triggerState',
        headerName: 'Status',
        flex: 1,
        minWidth: 90,
        cellRenderer: StatusCell,
      },
      {
        field: 'lastRunUtc',
        headerName: 'Last Run',
        flex: 1.2,
        minWidth: 110,
        cellRenderer: LastRunCell,
      },
      {
        field: 'nextFireTimeUtc',
        headerName: 'Next Fire',
        flex: 1.2,
        minWidth: 110,
        cellRenderer: NextFireCell,
      },
      {
        field: 'lastDurationMs',
        headerName: 'Duration',
        flex: 0.8,
        minWidth: 80,
        cellRenderer: DurationCell,
      },
      {
        field: 'lastSucceeded',
        headerName: 'Result',
        flex: 0.6,
        minWidth: 60,
        cellRenderer: ResultCell,
      },
    ],
    []
  );

  const onRowClicked = useCallback((params: { data: JobSummary | undefined }) => {
    if (!params.data) return;
    setSelectedJob(params.data);
    setExpandedJob((prev) => (prev === params.data!.name ? null : params.data!.name));
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!selectedJob || triggerMutation.isPending}
          onClick={() => selectedJob && triggerMutation.mutate(selectedJob.name)}
        >
          <Play className="size-3.5 mr-1" />
          Trigger Now
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={
            !selectedJob || selectedJob.triggerState === 'Paused' || pauseMutation.isPending
          }
          onClick={() => selectedJob && pauseMutation.mutate(selectedJob.name)}
        >
          <Pause className="size-3.5 mr-1" />
          Pause
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={
            !selectedJob || selectedJob.triggerState !== 'Paused' || resumeMutation.isPending
          }
          onClick={() => selectedJob && resumeMutation.mutate(selectedJob.name)}
        >
          <RotateCw className="size-3.5 mr-1" />
          Resume
        </Button>
        <div className="flex-1" />
        {selectedJob && (
          <span className="text-xs text-foreground-muted">
            Selected: <strong>{selectedJob.name}</strong>
          </span>
        )}
      </div>

      {/* Grid */}
      <div
        className="ag-theme-quartz rounded-md border"
        style={{ height: jobs.length > 0 ? Math.min(500, 48 + jobs.length * 48) : 300 }}
      >
        <AgGridReact<JobSummary>
          ref={gridRef}
          theme={agGridTheme}
          modules={[AllCommunityModule]}
          rowData={jobs}
          columnDefs={columnDefs}
          rowHeight={44}
          loading={isLoading}
          suppressMovableColumns
          suppressCellFocus
          animateRows={false}
          rowSelection="single"
          onRowClicked={onRowClicked}
        />
      </div>

      {/* Expandable history panel */}
      {expandedJob && (
        <div className="rounded-md border bg-surface">
          <div className="px-4 pt-3 pb-1 text-sm font-medium">Execution History: {expandedJob}</div>
          <HistoryPanel jobName={expandedJob} />
        </div>
      )}
    </div>
  );
}
