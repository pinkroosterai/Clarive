import { ArrowLeft, Clock, Play, Square, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface MatrixToolbarProps {
  entryId: string;
  onRunAll: () => void;
  onAbortAll: () => void;
  isRunning: boolean;
  batchProgress: { current: number; total: number } | null;
  matrixHasCells: boolean;
  onClearMatrix: () => void;
  showHistory: boolean;
  onToggleHistory: () => void;
}

export function MatrixToolbar({
  entryId,
  onRunAll,
  onAbortAll,
  isRunning,
  batchProgress,
  matrixHasCells,
  onClearMatrix,
  showHistory,
  onToggleHistory,
}: MatrixToolbarProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => navigate(`/entry/${entryId}`)}
            aria-label="Back to editor"
          >
            <ArrowLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Back to editor</TooltipContent>
      </Tooltip>

      {/* Run / Stop */}
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
        <Button
          size="sm"
          className="gap-2"
          onClick={onRunAll}
          disabled={!matrixHasCells}
        >
          <Play className="size-3.5" />
          Run All
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* History + Clear */}
      <div className="flex items-center gap-1">
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
              onClick={onClearMatrix}
              disabled={!matrixHasCells}
              aria-label="Clear grid"
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear all</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
