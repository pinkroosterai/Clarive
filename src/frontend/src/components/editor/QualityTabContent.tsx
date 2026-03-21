import { BarChart3, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { QualityScoreCard } from '@/components/wizard/QualityScoreCard';
import type { Evaluation, IterationScore, VersionInfo } from '@/types';

export interface QualityTabContentProps {
  evaluation?: Evaluation | null;
  localEvaluation?: Evaluation | null;
  isDirty: boolean;
  isEvaluating: boolean;
  onEvaluate: () => void;
  versions: VersionInfo[];
}

function buildScoreHistory(versions: VersionInfo[]): IterationScore[] {
  return versions
    .filter((v) => v.evaluation && v.evaluationAverageScore != null)
    .map((v) => ({
      iteration: v.version,
      scores: v.evaluation!.dimensions,
      averageScore: v.evaluationAverageScore!,
    }));
}

export function QualityTabContent({
  evaluation,
  localEvaluation,
  isDirty,
  isEvaluating,
  onEvaluate,
  versions,
}: QualityTabContentProps) {
  const activeEvaluation = localEvaluation ?? evaluation ?? null;
  const hasEvaluation = activeEvaluation != null;
  const canEvaluate = isDirty || !hasEvaluation;
  const scoreHistory = buildScoreHistory(versions);

  return (
    <div className="space-y-4">
      {hasEvaluation ? (
        <QualityScoreCard evaluation={activeEvaluation} scoreHistory={scoreHistory} />
      ) : (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-elevated">
            <BarChart3 className="size-6 text-foreground-muted" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No evaluation yet</p>
            <p className="text-xs text-foreground-muted">
              Evaluate your prompt to get quality scores across clarity, effectiveness,
              completeness, and faithfulness.
            </p>
          </div>
        </div>
      )}

      <Button
        variant={hasEvaluation ? 'outline' : 'default'}
        size="sm"
        className="w-full"
        onClick={onEvaluate}
        disabled={!canEvaluate || isEvaluating}
      >
        {isEvaluating ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Evaluating…
          </>
        ) : hasEvaluation ? (
          <>
            <RefreshCw className="size-4" />
            Re-evaluate
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Evaluate
          </>
        )}
      </Button>

      {hasEvaluation && !isDirty && (
        <p className="text-xs text-foreground-muted text-center">
          Edit the prompt to enable re-evaluation.
        </p>
      )}
    </div>
  );
}
