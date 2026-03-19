import { Play, Trash2, X } from 'lucide-react';

import type { QueuedModel } from './utils';

import { Button } from '@/components/ui/button';

interface QueueStripProps {
  queue: QueuedModel[];
  onRemove: (index: number) => void;
  onClear: () => void;
  onRunQueue: () => void;
  isStreaming: boolean;
  isBatchRunning: boolean;
  batchCurrent: number;
  batchTotal: number;
}

function formatParams(item: QueuedModel): string {
  if (item.isReasoning) {
    return `reasoning:${item.reasoningEffort} · ${item.maxTokens} tok`;
  }
  return `temp ${item.temperature.toFixed(1)} · ${item.maxTokens} tok`;
}

export default function QueueStrip({
  queue,
  onRemove,
  onClear,
  onRunQueue,
  isStreaming,
  isBatchRunning,
  batchCurrent,
  batchTotal,
}: QueueStripProps) {
  return (
    <div className="shrink-0 border-b border-border-subtle bg-surface/50 px-3 sm:px-6 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground-muted shrink-0">
          {isBatchRunning ? `Running ${batchCurrent}/${batchTotal}` : `Queue (${queue.length})`}
        </span>

        {/* Queue items */}
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1">
          {queue.map((item, i) => (
            <div
              key={`${item.model.modelId}-${i}`}
              className="flex items-center gap-1.5 text-xs bg-elevated rounded-md px-2 py-1 shrink-0"
            >
              <span className="font-medium">{item.model.displayName || item.model.modelId}</span>
              <span className="text-foreground-muted">{formatParams(item)}</span>
              {!isStreaming && (
                <button
                  onClick={() => onRemove(i)}
                  className="text-foreground-muted hover:text-foreground ml-0.5"
                  aria-label={`Remove ${item.model.displayName || item.model.modelId}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        {!isStreaming && queue.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button size="sm" variant="ghost" onClick={onClear} title="Clear queue">
              <Trash2 className="size-3 mr-1" />
              Clear
            </Button>
            <Button size="sm" onClick={onRunQueue} title="Run all queued models">
              <Play className="size-3 mr-1.5" />
              Run Queue ({queue.length})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
