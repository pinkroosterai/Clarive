import { AlertTriangle, Clock, Loader2, MousePointerClick } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import { SegmentTimeline } from '@/components/playground/SegmentTimeline';
import { scoreColor } from '@/components/wizard/scoreUtils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/utils';
import type { StreamSegment } from '@/hooks/streamingTypes';
import type { TestRunResponse } from '@/services/api/playgroundService';
import type { MatrixCell, MatrixState } from '@/types/matrix';
import { cellKey, getCell } from '@/types/matrix';

interface MatrixDetailDrawerProps {
  state: MatrixState;
  activeStreamSegments: StreamSegment[];
  activeStreamKey: string;
  historyRun?: TestRunResponse | null;
}

export function MatrixDetailDrawer({
  state,
  activeStreamSegments,
  activeStreamKey,
  historyRun,
}: MatrixDetailDrawerProps) {
  const { selectedCell, versions, models } = state;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback(async (text: string, index: number) => {
    try {
      await copyToClipboard(text);
      setCopiedIndex(index);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  // Show history run if selected
  if (historyRun) {
    const responseText = historyRun.conversationLog
      ?.filter((m) => m.role === 'assistant')
      .map((m) => m.content)
      .join('\n\n');
    const avgScore = historyRun.judgeScores?.averageScore ?? null;

    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border-subtle space-y-1 shrink-0">
          <div className="text-sm font-medium">History Run</div>
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <span>{historyRun.model}</span>
            <span>
              {new Date(historyRun.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            {responseText ? (
              <div className="rounded-lg border border-border-subtle bg-surface p-4 text-sm whitespace-pre-wrap">
                {responseText}
              </div>
            ) : (
              <p className="text-sm text-foreground-muted">No response content</p>
            )}
          </div>
        </ScrollArea>
        {avgScore != null && (
          <div className="p-4 border-t border-border-subtle shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-muted">Score</span>
              <span className={cn('text-lg font-bold tabular-nums', scoreColor(avgScore).text)}>
                {avgScore.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!selectedCell) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-foreground-muted gap-3 px-6">
        <MousePointerClick className="size-8 opacity-40" />
        <p className="text-sm text-center">Select a cell to view results</p>
        <p className="text-xs text-center opacity-60">
          Double-click a cell to run it
        </p>
      </div>
    );
  }

  const cell = getCell(state, selectedCell.versionId, selectedCell.modelId);
  const version = versions.find((v) => v.id === selectedCell.versionId);
  const model = models.find((m) => m.modelId === selectedCell.modelId);

  if (!cell || !version || !model) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-muted text-sm">
        Cell not found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border-subtle space-y-1 shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium truncate">{version.label}</div>
          <Badge variant="outline" className="text-xs shrink-0">
            {model.displayName}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span className="capitalize">{version.type}</span>
          <span>{model.providerName}</span>
          {cell.elapsedMs != null && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {(cell.elapsedMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <CellBody
            cell={cell}
            liveSegments={
              cell.status === 'running' &&
              activeStreamKey === cellKey(selectedCell.versionId, selectedCell.modelId)
                ? activeStreamSegments
                : undefined
            }
            copiedIndex={copiedIndex}
            handleCopy={handleCopy}
          />
        </div>
      </ScrollArea>

      {/* Footer — score */}
      {cell.score != null && (
        <div className="p-4 border-t border-border-subtle shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground-muted">Score</span>
            <span className={cn('text-lg font-bold tabular-nums', scoreColor(cell.score).text)}>
              {cell.score.toFixed(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CellBody({
  cell,
  liveSegments,
  copiedIndex,
  handleCopy,
}: {
  cell: MatrixCell;
  liveSegments?: StreamSegment[];
  copiedIndex: number | null;
  handleCopy: (text: string, index: number) => Promise<void>;
}) {
  // Use live streaming segments (from ref sync) when available, otherwise fall back to persisted
  const segments = liveSegments ?? cell.segments;

  switch (cell.status) {
    case 'empty':
      return (
        <p className="text-sm text-foreground-muted">
          This cell hasn&apos;t been run yet. Double-click it or click Run All.
        </p>
      );

    case 'queued':
      return (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Clock className="size-4" />
          Queued — waiting for other cells to complete
        </div>
      );

    case 'running':
    case 'completed':
      if (segments.length === 0 && cell.status === 'running') {
        return (
          <div className="flex items-center gap-2 text-sm text-foreground-muted">
            <Loader2 className="size-4 animate-spin" />
            Generating...
          </div>
        );
      }
      return (
        <SegmentTimeline
          segments={segments}
          isStreaming={cell.status === 'running'}
          copiedIndex={copiedIndex}
          handleCopy={handleCopy}
        />
      );

    case 'error':
      return (
        <div className="flex items-start gap-2 rounded-md border border-error-border bg-error-bg p-3 text-sm">
          <AlertTriangle className="size-4 text-error-text shrink-0 mt-0.5" />
          <span className="text-error-text">{cell.error ?? 'An error occurred'}</span>
        </div>
      );

    default:
      return null;
  }
}
