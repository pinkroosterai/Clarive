import { Clock, FileText, Play, Square, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MatrixToolbarProps {
  onRunAll: () => void;
  onAbortAll: () => void;
  isRunning: boolean;
  batchProgress: { current: number; total: number } | null;
  matrixHasCells: boolean;
  runDisabledReason: string | null;
  onClearMatrix: () => void;
  showHistory: boolean;
  onToggleHistory: () => void;
  hasCompletedCells: boolean;
  onGenerateReport: () => void;
}

export function MatrixToolbar({
  onRunAll,
  onAbortAll,
  isRunning,
  batchProgress,
  matrixHasCells,
  runDisabledReason,
  onClearMatrix,
  showHistory,
  onToggleHistory,
  hasCompletedCells,
  onGenerateReport,
}: MatrixToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Secondary actions: Clear, History, Report */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onClearMatrix}
              disabled={!matrixHasCells}
              aria-label="Clear grid"
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear all</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showHistory ? 'secondary' : 'ghost'}
              size="icon"
              className="size-8 shrink-0"
              onClick={onToggleHistory}
              aria-label="Toggle history"
            >
              <Clock className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Test history</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onGenerateReport}
              disabled={!hasCompletedCells}
              aria-label="Generate report"
            >
              <FileText className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate report</TooltipContent>
        </Tooltip>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Primary action: Run / Stop */}
      {isRunning ? (
        <Button variant="destructive" size="sm" className="gap-2" onClick={onAbortAll}>
          <Square className="size-3.5" />
          Stop
          {batchProgress && (
            <span className="text-xs opacity-80">
              ({batchProgress.current}/{batchProgress.total})
            </span>
          )}
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={runDisabledReason ? 0 : undefined}>
              <Button size="sm" className="gap-2" onClick={onRunAll} disabled={!!runDisabledReason}>
                <Play className="size-3.5" />
                Run All
              </Button>
            </span>
          </TooltipTrigger>
          {runDisabledReason && <TooltipContent>{runDisabledReason}</TooltipContent>}
        </Tooltip>
      )}
    </div>
  );
}
