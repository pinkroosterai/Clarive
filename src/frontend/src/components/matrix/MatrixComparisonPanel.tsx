import { Copy } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import { SegmentTimeline } from '@/components/playground/SegmentTimeline';
import { scoreColor } from '@/components/wizard/scoreUtils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/utils';
import type { StreamSegment } from '@/hooks/streamingTypes';
import type { ComparisonFilter, MatrixCell, MatrixState } from '@/types/matrix';
import { cellKey } from '@/types/matrix';

interface MatrixComparisonPanelProps {
  state: MatrixState;
  comparisonFilter: ComparisonFilter;
  onFilterChange: (filter: ComparisonFilter) => void;
  activeStreamSegments: StreamSegment[];
  activeStreamKey: string;
}

function getResponseText(segments: StreamSegment[]): string {
  return segments
    .filter((s) => s.type === 'response')
    .map((s) => s.text)
    .join('');
}

export function MatrixComparisonPanel({
  state,
  comparisonFilter,
  onFilterChange,
  activeStreamSegments,
  activeStreamKey,
}: MatrixComparisonPanelProps) {
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

  // Collect cells that have results (completed or running)
  const resultCells = useMemo(() => {
    const cells: MatrixCell[] = [];
    for (const cell of Object.values(state.cells)) {
      if (cell.status === 'completed' || cell.status === 'running') {
        cells.push(cell);
      }
    }
    return cells;
  }, [state.cells]);

  // Apply filter
  const filteredCells = useMemo(() => {
    if (comparisonFilter === 'all') return resultCells;
    if (comparisonFilter.type === 'model') {
      return resultCells.filter((c) => c.modelId === comparisonFilter.modelId);
    }
    return resultCells.filter((c) => c.versionId === comparisonFilter.versionId);
  }, [resultCells, comparisonFilter]);

  // Build tab data — only tabs with at least one result cell
  const tabs = useMemo(() => {
    const items: { label: string; count: number; filter: ComparisonFilter }[] = [
      { label: 'All', count: resultCells.length, filter: 'all' },
    ];

    for (const model of state.models) {
      const count = resultCells.filter((c) => c.modelId === model.modelId).length;
      if (count > 0) {
        items.push({
          label: model.displayName,
          count,
          filter: { type: 'model', modelId: model.modelId },
        });
      }
    }

    for (const version of state.versions) {
      const count = resultCells.filter((c) => c.versionId === version.id).length;
      if (count > 0) {
        items.push({
          label: version.label,
          count,
          filter: { type: 'version', versionId: version.id },
        });
      }
    }

    return items;
  }, [state.models, state.versions, resultCells]);

  // Don't render if no results
  if (resultCells.length === 0) return null;

  const isActiveFilter = (filter: ComparisonFilter) => {
    if (comparisonFilter === 'all' && filter === 'all') return true;
    if (comparisonFilter === 'all' || filter === 'all') return false;
    return (
      comparisonFilter.type === filter.type &&
      (comparisonFilter.type === 'model'
        ? comparisonFilter.modelId === (filter as { type: 'model'; modelId: string }).modelId
        : comparisonFilter.versionId === (filter as { type: 'version'; versionId: string }).versionId)
    );
  };

  const colCount = filteredCells.length;
  const needsScroll = colCount > 2;

  return (
    <div className="mt-4 pt-4 border-t border-border-subtle space-y-3">
      {/* Tab pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map((tab, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onFilterChange(tab.filter)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              isActiveFilter(tab.filter)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 hover:bg-muted text-foreground-muted',
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Columns grid */}
      {filteredCells.length > 0 && (
        <ScrollArea>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: needsScroll
                ? `repeat(${colCount}, minmax(50%, 1fr))`
                : `repeat(${colCount}, minmax(0, 1fr))`,
            }}
          >
            {filteredCells.map((cell, colIdx) => {
              const model = state.models.find((m) => m.modelId === cell.modelId);
              const version = state.versions.find((v) => v.id === cell.versionId);
              if (!model || !version) return null;

              const key = cellKey(cell.versionId, cell.modelId);
              const isStreaming = cell.status === 'running' && activeStreamKey === key;
              const segments = isStreaming ? activeStreamSegments : cell.segments;
              const responseText = getResponseText(segments);

              return (
                <div
                  key={key}
                  className="flex flex-col rounded-lg border border-border-subtle bg-surface overflow-hidden"
                >
                  {/* Column header */}
                  <div className="p-3 border-b border-border-subtle space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{model.displayName}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {version.label}
                      </Badge>
                    </div>
                    {cell.score != null && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-foreground-muted">Score</span>
                        <span
                          className={cn(
                            'text-xs font-semibold tabular-nums',
                            scoreColor(cell.score).text,
                          )}
                        >
                          {cell.score.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Column body */}
                  <div className="flex-1 p-3 overflow-y-auto max-h-[400px]">
                    {segments.length > 0 ? (
                      <SegmentTimeline
                        segments={segments}
                        isStreaming={isStreaming}
                        copiedIndex={copiedIndex}
                        handleCopy={handleCopy}
                        copyIndexOffset={colIdx * 100}
                        responseClassName="text-sm"
                      />
                    ) : cell.status === 'running' ? (
                      <p className="text-xs text-foreground-muted">Generating...</p>
                    ) : null}
                  </div>

                  {/* Column footer */}
                  {responseText && !isStreaming && (
                    <div className="p-2 border-t border-border-subtle flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopy(responseText, colIdx * 100 + 99)}
                        className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
                      >
                        <Copy className="size-3" />
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {needsScroll && <ScrollBar orientation="horizontal" />}
        </ScrollArea>
      )}
    </div>
  );
}
