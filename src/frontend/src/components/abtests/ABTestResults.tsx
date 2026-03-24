import { Star, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { scoreColor } from '@/components/wizard/scoreUtils';
import type { AbTestRunDetail } from '@/services/api/abTestService';

interface ABTestResultsProps {
  run: AbTestRunDetail;
}

export default function ABTestResults({ run }: ABTestResultsProps) {
  const { summary } = run;
  if (!summary) return null;

  const winner =
    summary.versionBAvg > summary.versionAAvg
      ? 'B'
      : summary.versionAAvg > summary.versionBAvg
        ? 'A'
        : null;
  const deltaPositive = summary.deltaPercent > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">A/B Test Results</h3>
            <p className="text-lg font-semibold">
              {run.versionALabel} vs {run.versionBLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {run.datasetName ?? 'Dataset'} &middot; {run.model} &middot; {run.resultCount} inputs
            </p>
          </div>
          <Badge variant={run.status === 'Completed' ? 'default' : 'destructive'}>
            {run.status}
          </Badge>
        </div>
      </div>

      {/* Score Comparison */}
      <div className="grid grid-cols-3 gap-4">
        <ScoreCard
          label={`Version A (${run.versionALabel})`}
          score={summary.versionAAvg}
          wins={summary.versionAWins}
          total={run.resultCount}
          isWinner={winner === 'A'}
        />
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-4">
          <div className="flex items-center gap-1.5">
            {deltaPositive ? (
              <TrendingUp className="size-4 text-green-600" />
            ) : summary.deltaPercent < 0 ? (
              <TrendingDown className="size-4 text-red-600" />
            ) : null}
            <span
              className={`text-xl font-bold ${deltaPositive ? 'text-green-600' : summary.deltaPercent < 0 ? 'text-red-600' : 'text-muted-foreground'}`}
            >
              {deltaPositive ? '+' : ''}
              {summary.deltaPercent.toFixed(1)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.ties} {summary.ties === 1 ? 'tie' : 'ties'}
          </p>
        </div>
        <ScoreCard
          label={`Version B (${run.versionBLabel})`}
          score={summary.versionBAvg}
          wins={summary.versionBWins}
          total={run.resultCount}
          isWinner={winner === 'B'}
        />
      </div>

      {/* Per-Dimension Table */}
      {Object.keys(summary.perDimension).length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Dimension</TableHead>
                <TableHead className="text-center text-xs">{run.versionALabel}</TableHead>
                <TableHead className="text-center text-xs">{run.versionBLabel}</TableHead>
                <TableHead className="text-center text-xs">Delta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(summary.perDimension).map(([dim, comp]) => (
                <TableRow key={dim}>
                  <TableCell className="text-sm font-medium capitalize">{dim}</TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm font-medium ${scoreColor(comp.versionAAvg).text}`}>
                      {comp.versionAAvg.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm font-medium ${scoreColor(comp.versionBAvg).text}`}>
                      {comp.versionBAvg.toFixed(1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`text-sm font-medium ${comp.delta > 0 ? 'text-green-600' : comp.delta < 0 ? 'text-red-600' : 'text-muted-foreground'}`}
                    >
                      {comp.delta > 0 ? '+' : ''}
                      {comp.delta.toFixed(1)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  score,
  wins,
  total,
  isWinner,
}: {
  label: string;
  score: number;
  wins: number;
  total: number;
  isWinner: boolean;
}) {
  const colors = scoreColor(score);
  return (
    <div
      className={`flex flex-col items-center rounded-lg border bg-card p-4 ${isWinner ? 'ring-2 ring-primary/30' : ''}`}
    >
      {isWinner && <Star className="mb-1 size-4 fill-yellow-500 text-yellow-500" />}
      <span className={`text-3xl font-bold ${colors.text}`}>{score.toFixed(1)}</span>
      <span className="mt-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">
        {wins}/{total} wins
      </span>
    </div>
  );
}
