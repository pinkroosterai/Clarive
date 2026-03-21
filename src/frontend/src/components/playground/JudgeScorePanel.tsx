import { scoreColor } from '@/components/wizard/scoreUtils';
import type { Evaluation } from '@/services/api/playgroundService';

// Fixed order so score rows align across comparison columns
const DIMENSION_ORDER = ['Accuracy', 'Helpfulness', 'Relevance', 'Coherence', 'Safety'];

export function JudgeScorePanel({ scores }: { scores: Evaluation }) {
  const sortedDimensions = Object.entries(scores.dimensions).sort(([a], [b]) => {
    const ai = DIMENSION_ORDER.indexOf(a);
    const bi = DIMENSION_ORDER.indexOf(b);
    // Known dimensions in canonical order, unknown ones at the end alphabetically
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="mt-4 pt-3 border-t border-border-subtle space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-8 rounded-full border-2 border-primary">
          <span className="text-xs font-bold text-primary">{scores.averageScore.toFixed(1)}</span>
        </div>
        <span className="text-xs text-foreground-muted">Output Quality</span>
      </div>
      <div className="space-y-1.5">
        {sortedDimensions.map(([dim, entry]) => {
          const { bar, text } = scoreColor(entry.score);
          return (
            <div key={dim} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground-muted w-20 shrink-0">{dim}</span>
                <div className="flex-1 h-1.5 rounded-full bg-elevated">
                  <div
                    className={`h-1.5 rounded-full ${bar}`}
                    style={{ width: `${(entry.score / 10) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-4 text-right ${text}`}>{entry.score}</span>
              </div>
              {entry.feedback && (
                <p className="text-[11px] text-foreground-muted pl-[calc(5rem+0.5rem)] leading-snug">
                  {entry.feedback}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
