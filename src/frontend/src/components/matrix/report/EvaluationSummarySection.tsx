import { Trophy } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { scoreColor } from '@/components/wizard/scoreUtils';
import type { EvaluationSummaryEntry } from '@/types/report';

interface EvaluationSummarySectionProps {
  entries: EvaluationSummaryEntry[];
}

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const colors = scoreColor(score);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {score.toFixed(1)}
    </span>
  );
}

export function EvaluationSummarySection({ entries }: EvaluationSummarySectionProps) {
  if (entries.length === 0) return null;

  // Collect all unique dimension names across entries
  const dimensionNames = Array.from(
    new Set(entries.flatMap((e) => (e.evaluation ? Object.keys(e.evaluation.dimensions) : [])))
  ).sort();

  // Find best average score
  const scoredEntries = entries.filter((e) => e.averageScore != null);
  const bestScore =
    scoredEntries.length > 0 ? Math.max(...scoredEntries.map((e) => e.averageScore!)) : null;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Model</TableHead>
            {dimensionNames.map((dim) => (
              <TableHead key={dim} className="text-center">
                {dim}
              </TableHead>
            ))}
            <TableHead className="text-center">Average</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, i) => {
            const isBest = bestScore != null && entry.averageScore === bestScore;
            return (
              <TableRow key={i}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    {isBest && <Trophy className="size-3.5 text-warning-text" />}
                    {entry.versionLabel}
                  </div>
                </TableCell>
                <TableCell>{entry.modelDisplayName}</TableCell>
                {dimensionNames.map((dim) => (
                  <TableCell key={dim} className="text-center">
                    <ScoreCell score={entry.evaluation?.dimensions[dim]?.score ?? null} />
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <ScoreCell score={entry.averageScore} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Dimension feedback details */}
      {entries.some((e) => e.evaluation) && (
        <details className="group">
          <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            Show evaluation feedback
          </summary>
          <div className="mt-3 space-y-4">
            {entries
              .filter((e) => e.evaluation)
              .map((entry, i) => (
                <div key={i} className="rounded-lg border border-border-subtle p-4 space-y-2">
                  <h5 className="text-sm font-medium">
                    {entry.versionLabel} × {entry.modelDisplayName}
                  </h5>
                  {Object.entries(entry.evaluation!.dimensions).map(([dim, d]) => (
                    <div key={dim} className="flex items-start gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-[160px] shrink-0">
                        <ScoreCell score={d.score} />
                        <span className="font-medium">{dim}</span>
                      </div>
                      <span className="text-muted-foreground">{d.feedback}</span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
