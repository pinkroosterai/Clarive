import { ChevronDown, ClipboardCheck } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { scoreColor } from '@/components/wizard/scoreUtils';
import { cn } from '@/lib/utils';
import type { Evaluation } from '@/services/api/playgroundService';

const DIMENSION_ORDER = ['Accuracy', 'Helpfulness', 'Relevance', 'Coherence', 'Safety'];

function scoreBorderColor(score: number) {
  if (score >= 8) return 'border-success-text';
  if (score >= 5) return 'border-warning-text';
  return 'border-error-text';
}

const tokenFormatter = new Intl.NumberFormat('en-US');

interface CellScorecardProps {
  modelName: string;
  versionLabel: string;
  evaluation: Evaluation;
  elapsedMs: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedTotalCostUsd?: number | null;
}

export function CellScorecard({
  modelName,
  versionLabel,
  evaluation,
  elapsedMs,
  inputTokens,
  outputTokens,
  estimatedTotalCostUsd,
}: CellScorecardProps) {
  const sortedDimensions = Object.entries(evaluation.dimensions).sort(([a], [b]) => {
    const ai = DIMENSION_ORDER.indexOf(a);
    const bi = DIMENSION_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const avg = evaluation.averageScore;
  const { text: avgText, label: avgLabel } = scoreColor(avg);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Evaluation</h3>
        </div>
        <p className="text-xs text-foreground-muted mt-1">
          {modelName} × {versionLabel}
        </p>
      </div>

      {/* Average score badge */}
      <div className="flex flex-col items-center gap-1 py-2">
        <div
          className={cn(
            'flex items-center justify-center size-16 rounded-full border-2',
            scoreBorderColor(avg),
          )}
        >
          <span className={cn('text-xl font-bold', avgText)}>{avg.toFixed(1)}</span>
        </div>
        <span className={cn('text-xs font-medium', avgText)}>{avgLabel}</span>
      </div>

      {/* Dimension breakdown */}
      <div className="space-y-1">
        {sortedDimensions.map(([dim, entry]) => {
          const { bar, text } = scoreColor(entry.score);
          const hasFeedback = !!entry.feedback;

          if (!hasFeedback) {
            return (
              <div key={dim} className="flex items-center gap-2 py-1">
                <span className="text-xs text-foreground-muted w-24 shrink-0">{dim}</span>
                <div className="flex-1 h-1.5 rounded-full bg-elevated">
                  <div
                    className={`h-1.5 rounded-full ${bar}`}
                    style={{ width: `${(entry.score / 10) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-6 text-right ${text}`}>{entry.score}</span>
              </div>
            );
          }

          return (
            <Collapsible key={dim}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center gap-2 py-1 group">
                  <span className="text-xs text-foreground-muted w-24 shrink-0 text-left">{dim}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-elevated">
                    <div
                      className={`h-1.5 rounded-full ${bar}`}
                      style={{ width: `${(entry.score / 10) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium w-6 text-right ${text}`}>{entry.score}</span>
                  <ChevronDown className="size-3 text-foreground-muted transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-xs text-foreground-muted pl-[calc(6rem+0.5rem)] pr-6 pt-1 pb-2 leading-relaxed">
                  {entry.feedback}
                </p>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Stats footer */}
      {(elapsedMs != null || inputTokens != null || outputTokens != null) && (
        <div className="text-xs text-foreground-muted text-center pt-2 border-t border-border-subtle">
          {[
            elapsedMs != null
              ? elapsedMs >= 1000 ? `${(elapsedMs / 1000).toFixed(1)}s` : `${elapsedMs}ms`
              : null,
            inputTokens != null || outputTokens != null
              ? `${tokenFormatter.format((inputTokens ?? 0) + (outputTokens ?? 0))} tok`
              : null,
            estimatedTotalCostUsd != null
              ? `~$${estimatedTotalCostUsd.toFixed(4)}`
              : inputTokens != null || outputTokens != null
                ? '\u2014'
                : null,
          ].filter(Boolean).join(' \u00b7 ')}
        </div>
      )}
    </div>
  );
}
