import { AlertTriangle, Clock } from 'lucide-react';

import { SegmentTimeline } from '@/components/playground/SegmentTimeline';
import type { FullResponseEntry } from '@/types/report';

interface FullResponsesSectionProps {
  responses: FullResponseEntry[];
}

export function FullResponsesSection({ responses }: FullResponsesSectionProps) {
  if (responses.length === 0) return null;

  return (
    <div className="space-y-4">
      {responses.map((entry, i) => (
        <div key={i} className="rounded-lg border border-border-subtle">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{entry.versionLabel}</span>
              <span className="text-muted-foreground">×</span>
              <span className="text-sm font-medium">{entry.modelDisplayName}</span>
            </div>
            {entry.elapsedMs != null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {(entry.elapsedMs / 1000).toFixed(1)}s
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {entry.error ? (
              <div className="flex items-center gap-2 text-sm text-error-text">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{entry.error}</span>
              </div>
            ) : (
              <SegmentTimeline segments={entry.segments} isStreaming={false} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
