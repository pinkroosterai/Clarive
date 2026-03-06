import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { ScoreHistoryChart } from './ScoreHistoryChart';

import type { Evaluation, IterationScore } from '@/types';

interface QualityScoreCardProps {
  evaluation?: Evaluation;
  scoreHistory?: IterationScore[];
}

const DIMENSIONS = [
  'Clarity',
  'Specificity',
  'Structure',
  'Completeness',
  'Autonomy',
  'Faithfulness',
  'Efficiency',
] as const;

function scoreColor(score: number) {
  if (score >= 8) return { bar: 'bg-success-text', text: 'text-success-text', label: 'Good' };
  if (score >= 5) return { bar: 'bg-warning-text', text: 'text-warning-text', label: 'Fair' };
  return { bar: 'bg-error-text', text: 'text-error-text', label: 'Poor' };
}

function DeltaIndicator({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (delta > 0) {
    return (
      <span className="flex items-center gap-0.5 text-success-text text-xs">
        <TrendingUp className="size-3" />+{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="flex items-center gap-0.5 text-error-text text-xs">
        <TrendingDown className="size-3" />
        {delta}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-foreground-secondary text-xs">
      <Minus className="size-3" />
    </span>
  );
}

export function QualityScoreCard({ evaluation, scoreHistory }: QualityScoreCardProps) {
  if (!evaluation || Object.keys(evaluation.dimensions).length === 0) return null;

  const previousScores =
    scoreHistory && scoreHistory.length >= 2 ? scoreHistory[scoreHistory.length - 2].scores : null;

  const averageScore =
    Object.values(evaluation.dimensions).reduce((sum, e) => sum + e.score, 0) /
    Object.keys(evaluation.dimensions).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          Quality Analysis
        </h3>
        <span className={`text-sm font-bold ${scoreColor(averageScore).text}`}>
          {averageScore.toFixed(1)}/10 · {scoreColor(averageScore).label}
        </span>
      </div>

      <div className="space-y-2">
        {DIMENSIONS.map((dim) => {
          const entry = evaluation.dimensions[dim];
          if (!entry) return null;
          const { bar, text } = scoreColor(entry.score);
          const prevEntry = previousScores?.[dim];

          return (
            <div key={dim} className="space-y-0.5">
              <div className="flex items-center gap-3">
                <span className="text-xs text-foreground-secondary w-24 shrink-0">{dim}</span>
                <div className="flex-1 h-2 rounded-full bg-elevated">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${bar}`}
                    style={{ width: `${(entry.score / 10) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-5 text-right ${text}`}>{entry.score}</span>
                {prevEntry && <DeltaIndicator current={entry.score} previous={prevEntry.score} />}
              </div>
              {entry.feedback && (
                <p className="text-xs text-foreground-secondary pl-[calc(6rem+0.75rem)] leading-snug">
                  {entry.feedback}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {scoreHistory && scoreHistory.length > 1 && <ScoreHistoryChart history={scoreHistory} />}
    </div>
  );
}
