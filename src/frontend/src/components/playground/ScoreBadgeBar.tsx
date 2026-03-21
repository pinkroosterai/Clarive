import { X } from 'lucide-react';

import { scoreColor } from '@/components/wizard/scoreUtils';
import type { TestRunResponse } from '@/services/api/playgroundService';

export function ScoreBadgeBar({
  pinnedRuns,
  activePinIndex,
  onSelectIndex,
  currentRunScore,
  currentRunVersionLabel,
  onClearAll,
  onScrollToCurrent,
  onUnpin,
  onClearCurrentRun,
}: {
  pinnedRuns: TestRunResponse[];
  activePinIndex: number;
  onSelectIndex: (index: number) => void;
  currentRunScore?: number | null;
  currentRunVersionLabel?: string | null;
  onClearAll?: () => void;
  onScrollToCurrent?: () => void;
  onUnpin?: (runId: string) => void;
  onClearCurrentRun?: () => void;
}) {
  const showCurrentPill = currentRunScore !== undefined;
  const currentColor = currentRunScore != null ? scoreColor(currentRunScore) : null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showCurrentPill && (
        <div
          className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs transition-all duration-150 ${
            activePinIndex === -1
              ? 'bg-primary/10 border border-primary/30 ring-2 ring-primary'
              : 'bg-primary/10 border border-primary/30 hover:bg-primary/20'
          }`}
        >
          <button onClick={onScrollToCurrent} className="inline-flex items-center gap-1.5 cursor-pointer" title="Scroll to current run">
            <span className="font-medium">Current Run</span>
            {currentRunVersionLabel && (
              <span className="text-[10px] font-medium text-foreground-muted">
                {currentRunVersionLabel}
              </span>
            )}
            {currentRunScore != null && (
              <span className={`font-bold tabular-nums ${currentColor?.text ?? ''}`}>
                {currentRunScore.toFixed(1)}
              </span>
            )}
          </button>
          {onClearCurrentRun && (
            <button
              onClick={(e) => { e.stopPropagation(); onClearCurrentRun(); }}
              className="p-0.5 rounded-full text-foreground-muted hover:text-foreground hover:bg-primary/20 transition-colors cursor-pointer"
              aria-label="Remove current run from comparison"
              title="Remove from comparison"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}
      {pinnedRuns.map((run, i) => {
        const isActive = activePinIndex >= 0 && i === activePinIndex;
        const score = run.judgeScores?.averageScore;
        const color = score !== undefined ? scoreColor(score) : null;
        return (
          <div
            key={run.id}
            className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs transition-all duration-150 ${
              isActive
                ? 'bg-elevated ring-2 ring-primary'
                : 'bg-elevated hover:bg-elevated/80'
            }`}
          >
            <button
              onClick={() => onSelectIndex(i)}
              className="inline-flex items-center gap-1.5 cursor-pointer"
              title={`View: ${run.model}`}
              aria-label={`View ${run.model}${score !== undefined ? `, score ${score.toFixed(1)}` : ''}`}
            >
              <span className="truncate max-w-[100px] font-medium" title={run.model}>{run.model}</span>
              {run.versionLabel && (
                <span className="text-[10px] font-medium text-foreground-muted">
                  {run.versionLabel}
                </span>
              )}
              {score !== undefined && (
                <span className={`font-bold tabular-nums ${color?.text ?? ''}`}>
                  {score.toFixed(1)}
                </span>
              )}
            </button>
            {onUnpin && (
              <button
                onClick={(e) => { e.stopPropagation(); onUnpin(run.id); }}
                className="p-0.5 rounded-full text-foreground-muted hover:text-foreground hover:bg-elevated/60 transition-colors cursor-pointer"
                aria-label={`Unpin ${run.model}`}
                title="Remove from comparison"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        );
      })}
      {onClearAll && pinnedRuns.length > 1 && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-foreground-muted hover:text-foreground hover:bg-elevated/80 transition-colors"
          aria-label="Clear all pinned runs"
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </div>
  );
}
