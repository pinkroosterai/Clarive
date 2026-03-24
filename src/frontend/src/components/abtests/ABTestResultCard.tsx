import { ChevronDown, Star } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { scoreColor } from '@/components/wizard/scoreUtils';
import type { AbTestResult } from '@/services/api/abTestService';

interface ABTestResultCardProps {
  result: AbTestResult;
  index: number;
  versionA: number;
  versionB: number;
}

export default function ABTestResultCard({
  result,
  index,
  versionA,
  versionB,
}: ABTestResultCardProps) {
  const [expanded, setExpanded] = useState(false);

  const aScore = result.versionAAvgScore;
  const bScore = result.versionBAvgScore;
  const winner =
    aScore != null && bScore != null
      ? aScore > bScore
        ? 'A'
        : bScore > aScore
          ? 'B'
          : null
      : null;

  return (
    <Card>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                {result.inputValues && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(result.inputValues).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-xs font-normal">
                        {k}={v}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {aScore != null && (
                  <span className={`text-sm font-medium ${scoreColor(aScore).text}`}>
                    {aScore.toFixed(1)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">vs</span>
                {bScore != null && (
                  <span className={`text-sm font-medium ${scoreColor(bScore).text}`}>
                    {bScore.toFixed(1)}
                  </span>
                )}
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4">
              {/* Version A */}
              <OutputColumn
                label={`v${versionA}`}
                output={result.versionAOutput}
                scores={result.versionAScores}
                avgScore={result.versionAAvgScore}
                isWinner={winner === 'A'}
              />
              {/* Version B */}
              <OutputColumn
                label={`v${versionB}`}
                output={result.versionBOutput}
                scores={result.versionBScores}
                avgScore={result.versionBAvgScore}
                isWinner={winner === 'B'}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function OutputColumn({
  label,
  output,
  scores,
  avgScore,
  isWinner,
}: {
  label: string;
  output: string | null;
  scores: Record<string, { score: number; feedback: string }> | null;
  avgScore: number | null;
  isWinner: boolean;
}) {
  const colors = avgScore != null ? scoreColor(avgScore) : null;

  return (
    <div className={`space-y-2 rounded-md border p-3 ${isWinner ? 'ring-2 ring-primary/20' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isWinner && <Star className="size-3.5 fill-yellow-500 text-yellow-500" />}
          <span className="text-xs font-medium">{label}</span>
        </div>
        {avgScore != null && colors && (
          <Badge variant="outline" className={`text-xs ${colors.text}`}>
            {avgScore.toFixed(1)}
          </Badge>
        )}
      </div>

      <ScrollArea className="max-h-48">
        <p className="whitespace-pre-wrap text-sm">{output ?? 'No output'}</p>
      </ScrollArea>

      {scores && Object.keys(scores).length > 0 && (
        <div className="space-y-1 border-t pt-2">
          {Object.entries(scores).map(([dim, entry]) => (
            <div key={dim} className="flex items-center justify-between text-xs">
              <span className="capitalize text-muted-foreground">{dim}</span>
              <span className={scoreColor(entry.score).text}>{entry.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
