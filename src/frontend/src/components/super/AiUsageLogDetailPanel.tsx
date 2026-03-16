import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';

import type { AiUsageLogEntry } from '@/services/api/aiUsageService';

const formatCurrency = (value: number | null): string => {
  if (value == null || value === 0) return '—';
  return `$${value.toFixed(4)}`;
};

const formatNumber = (value: number): string => value.toLocaleString();

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const durationColorClass = (ms: number): string => {
  if (ms < 1000) return 'text-success-text';
  if (ms < 3000) return 'text-warning-text';
  return 'text-error-text';
};

interface AiUsageLogDetailPanelProps {
  row: AiUsageLogEntry;
  onClose: () => void;
}

export default function AiUsageLogDetailPanel({ row, onClose }: AiUsageLogDetailPanelProps) {
  const totalCost = (row.estimatedInputCostUsd ?? 0) + (row.estimatedOutputCostUsd ?? 0);
  const totalTokens = row.inputTokens + row.outputTokens;
  const inputPct = totalTokens > 0 ? (row.inputTokens / totalTokens) * 100 : 0;

  return (
    <div className="rounded-lg border bg-background-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <ChevronDown className="size-4" />
          Request Details
        </button>
        <span className="text-xs text-foreground-muted font-mono">{row.id.slice(0, 8)}...</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Timestamp</div>
          <div>{format(new Date(row.createdAt), 'MMM d, yyyy HH:mm:ss.SSS')}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Model</div>
          <div className="font-medium">{row.displayModel}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Action Type</div>
          <div>{row.actionType}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Duration</div>
          <div className={durationColorClass(row.durationMs)}>{formatDuration(row.durationMs)}</div>
        </div>
      </div>

      {/* Token breakdown bar */}
      <div>
        <div className="text-foreground-muted text-xs mb-1.5">Token Breakdown</div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full"
              style={{ width: `${inputPct}%` }}
            />
          </div>
          <div className="text-xs text-foreground-muted whitespace-nowrap">
            {formatNumber(row.inputTokens)} in / {formatNumber(row.outputTokens)} out ={' '}
            {formatNumber(totalTokens)} total
          </div>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Input Cost</div>
          <div>{formatCurrency(row.estimatedInputCostUsd)}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Output Cost</div>
          <div>{formatCurrency(row.estimatedOutputCostUsd)}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Total Cost</div>
          <div className="font-medium">{formatCurrency(totalCost)}</div>
        </div>
        {row.entryId && (
          <div>
            <div className="text-foreground-muted text-xs mb-0.5">Linked Entry</div>
            <div className="text-primary font-mono text-xs">{row.entryId.slice(0, 8)}...</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">User</div>
          <div>{row.userEmail ?? '—'}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Tenant</div>
          <div>{row.tenantName ?? '—'}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Provider</div>
          <div>{row.provider || '—'}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Model</div>
          <div>{row.model}</div>
        </div>
      </div>
    </div>
  );
}
