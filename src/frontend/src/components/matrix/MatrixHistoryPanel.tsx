import { useQuery } from '@tanstack/react-query';
import { Clock, Loader2 } from 'lucide-react';

import { scoreColor } from '@/components/wizard/scoreUtils';
import { cn } from '@/lib/utils';
import { getTestRuns, type TestRunResponse } from '@/services/api/playgroundService';

interface MatrixHistoryPanelProps {
  entryId: string;
  selectedRunId: string | null;
  onSelectRun: (run: TestRunResponse) => void;
}

export function MatrixHistoryPanel({ entryId, selectedRunId, onSelectRun }: MatrixHistoryPanelProps) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['test-runs', entryId],
    queryFn: () => getTestRuns(entryId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-foreground-muted text-sm gap-2">
        <Loader2 className="size-4 animate-spin" />
        Loading history...
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-foreground-muted text-sm gap-2">
        <Clock className="size-4" />
        No test runs yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium text-foreground-muted px-1 mb-2">
        Test History ({runs.length})
      </h3>
      <div className="space-y-1 max-h-[200px] overflow-y-auto">
        {runs.map((run) => {
          const isSelected = selectedRunId === run.id;
          const avgScore = run.judgeScores?.averageScore ?? null;

          return (
            <button
              key={run.id}
              type="button"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left text-xs transition-colors',
                'hover:bg-elevated/50',
                isSelected && 'bg-primary/5 ring-1 ring-primary/20',
              )}
              onClick={() => onSelectRun(run)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{run.model}</div>
                <div className="text-foreground-muted">
                  {new Date(run.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              {avgScore !== null && (
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums shrink-0',
                    scoreColor(avgScore).text,
                  )}
                >
                  {avgScore.toFixed(1)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
