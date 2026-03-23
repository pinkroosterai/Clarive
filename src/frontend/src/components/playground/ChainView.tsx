import { Check, Copy, Loader2 } from 'lucide-react';

import { CollapsedPrompt } from './ConversationView';
import { SegmentTimeline } from './SegmentTimeline';

import { Button } from '@/components/ui/button';
import type { StreamSegment } from '@/hooks/usePlaygroundStreaming';
import { renderTemplate } from '@/lib/templateRenderer';

interface ChainViewProps {
  prompts: { content: string }[];
  segments: StreamSegment[];
  streamedResponses: Record<number, string>;
  currentPromptIndex: number;
  isStreaming: boolean;
  responseCount: number;
  copiedIndex: number | null;
  handleCopy: (text: string, index: number) => Promise<void>;
  fieldValues: Record<string, string>;
}

export function ChainView({
  prompts,
  segments,
  streamedResponses,
  currentPromptIndex,
  isStreaming,
  responseCount,
  copiedIndex,
  handleCopy,
  fieldValues,
}: ChainViewProps) {
  return (
    <>
      <div className="space-y-0">
        {prompts.map((prompt, i) => {
          const response = streamedResponses[i];
          const isActive = isStreaming && i === currentPromptIndex;
          const isComplete = response !== undefined && (!isStreaming || i < currentPromptIndex);

          return (
            <div key={i} className="flex gap-4">
              {/* Step connector */}
              <div className="flex flex-col items-center pt-1">
                <div
                  className={`size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground animate-pulse'
                      : isComplete
                        ? 'bg-primary/20 text-primary'
                        : 'bg-elevated text-foreground-muted border border-border-subtle'
                  }`}
                >
                  {isActive ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isComplete ? (
                    <Check className="size-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                {i < prompts.length - 1 && (
                  <div className="w-0.5 flex-1 bg-border-subtle min-h-6" />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-6 min-w-0 space-y-2">
                <CollapsedPrompt
                  content={renderTemplate(prompt.content, fieldValues)}
                  promptIndex={i}
                />
                <div className="space-y-2">
                  <SegmentTimeline
                    segments={segments.filter((s) => s.promptIndex === i)}
                    isStreaming={isActive}
                    copiedIndex={copiedIndex}
                    handleCopy={handleCopy}
                    copyIndexOffset={i}
                    responseClassName={`rounded-lg border p-4 ${
                      isActive
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border-subtle bg-surface'
                    }`}
                  />
                </div>
                {isStreaming && i === responseCount && !response && (
                  <div className="rounded-lg border border-border-subtle bg-surface/50 p-4">
                    <div className="h-6 w-2/3 rounded bg-foreground-muted/10 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Copy all for chains */}
      {!isStreaming && responseCount >= 2 && (
        <div className="flex justify-end mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const allText = prompts
                .map((_, i) => {
                  const r = streamedResponses[i];
                  return r ? `## Prompt ${i + 1}\n${r}` : null;
                })
                .filter(Boolean)
                .join('\n\n');
              handleCopy(allText, -1);
            }}
            className="gap-1.5 text-xs"
          >
            <Copy className="size-3.5" /> Copy all
          </Button>
        </div>
      )}
    </>
  );
}
