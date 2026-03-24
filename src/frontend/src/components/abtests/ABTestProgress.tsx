import { Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { AbTestProgressEvent } from '@/services/api/abTestService';

const stepLabels: Record<string, string> = {
  starting: 'Starting A/B test...',
  running_version_a: 'Testing Version A',
  running_version_b: 'Testing Version B',
  judging: 'Evaluating outputs',
  completed: 'Complete!',
};

interface ABTestProgressProps {
  latestEvent: AbTestProgressEvent | null;
  onCancel: () => void;
}

export default function ABTestProgress({ latestEvent, onCancel }: ABTestProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const progress = latestEvent
    ? latestEvent.totalRows > 0
      ? (latestEvent.currentRow / latestEvent.totalRows) * 100
      : 0
    : 0;

  const label = latestEvent
    ? (stepLabels[latestEvent.type] ?? latestEvent.type)
    : 'Initializing...';
  const detail = latestEvent?.message ?? '';
  const isComplete = latestEvent?.type === 'completed';

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
      <div className="flex items-center justify-center gap-3">
        {!isComplete && <Loader2 className="size-6 animate-spin text-primary" />}
        <h2 className="text-lg font-semibold">{label}</h2>
      </div>

      <Progress value={progress} className="h-3" />

      <div className="space-y-1">
        {latestEvent && latestEvent.totalRows > 0 && (
          <p className="text-sm text-muted-foreground">
            {latestEvent.currentRow} / {latestEvent.totalRows} inputs
            {latestEvent.versionLabel && ` — ${latestEvent.versionLabel}`}
          </p>
        )}
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        <p className="text-xs text-muted-foreground">Elapsed: {timeStr}</p>
      </div>

      {!isComplete && (
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="mr-1.5 size-3.5" />
          Cancel
        </Button>
      )}
    </div>
  );
}
