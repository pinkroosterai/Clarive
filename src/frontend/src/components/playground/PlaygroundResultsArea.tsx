import { Play, Square, Loader2 } from 'lucide-react';
import { useMemo } from 'react';

import { ChainView } from './ChainView';
import { ComparisonGrid } from './ComparisonGrid';
import { JudgeScorePanel } from './JudgeScorePanel';
import { PlaygroundErrorDisplay } from './PlaygroundErrorDisplay';
import { SegmentTimeline } from './SegmentTimeline';
import { StreamingIndicator } from './StreamingIndicator';
import { TemplateVariablesSection } from './TemplateVariablesSection';
import type {
  PlaygroundStreamingState,
  PlaygroundComparisonState,
  PlaygroundTemplateState,
  PlaygroundJudgeState,
} from './utils';

import { ScrollArea } from '@/components/ui/scroll-area';
import { scoreColor } from '@/components/wizard/scoreUtils';
import type { TestRunPromptResponse } from '@/services/api/playgroundService';

// ── Collapsible prompt/system message display ──

function PromptSection({
  systemMessage,
  renderedPrompts,
}: {
  systemMessage?: string | null;
  renderedPrompts?: TestRunPromptResponse[] | null;
}) {
  if (!systemMessage && (!renderedPrompts || renderedPrompts.length === 0)) return null;
  return (
    <div className="space-y-2 mb-3">
      {systemMessage && (
        <div className="bg-elevated/50 border-l-2 border-l-primary rounded-r-md p-3">
          <div className="text-[10px] font-semibold text-primary mb-1 uppercase tracking-wider">
            System
          </div>
          <div className="text-xs font-mono whitespace-pre-wrap text-foreground-muted">
            {systemMessage}
          </div>
        </div>
      )}
      {renderedPrompts?.map((p) => (
        <div
          key={p.promptIndex}
          className="bg-elevated/30 rounded-md p-3 border border-border-subtle"
        >
          {(renderedPrompts.length > 1 || systemMessage) && (
            <div className="text-[10px] font-semibold text-foreground-muted mb-1 uppercase tracking-wider">
              Prompt {p.promptIndex + 1}
            </div>
          )}
          <div className="text-xs font-mono whitespace-pre-wrap text-foreground-muted max-h-32 overflow-y-auto scrollbar-themed">
            {p.content}
          </div>
        </div>
      ))}
    </div>
  );
}

interface PlaygroundResultsAreaProps {
  prompts: { content: string }[];
  isChain: boolean;
  streaming: PlaygroundStreamingState;
  comparison: PlaygroundComparisonState;
  template: PlaygroundTemplateState;
  judge: PlaygroundJudgeState;
  copiedIndex: number | null;
  handleRun: () => void;
  handleCopy: (text: string, index: number) => Promise<void>;
  currentVersionLabel: string | null;
}

export default function PlaygroundResultsArea({
  prompts,
  isChain,
  streaming,
  comparison,
  template,
  judge,
  copiedIndex,
  handleRun,
  handleCopy,
  currentVersionLabel,
}: PlaygroundResultsAreaProps) {
  const {
    isStreaming,
    firstTokenReceived,
    segments,
    error,
    wasStopped,
    rateLimitCountdown,
    elapsedSeconds,
    approxOutputTokens,
    lastTokens,
    hasResponses,
    responseCount,
    responseAreaRef,
  } = streaming;
  const {
    pinnedRuns,
    onUnpin,
    onClearAllPins,
    activeCarouselIndex,
    setActiveCarouselIndex,
    onClearCurrentRun,
  } = comparison;
  const { fieldValues } = template;
  const { currentJudgeScores, isJudging } = judge;
  const hasPins = pinnedRuns.length > 0;
  const hasCurrentRun = hasResponses || isStreaming;

  // Derive per-prompt views from segments using promptIndex
  const streamedResponses = useMemo(() => {
    const map: Record<number, string> = {};
    for (const s of segments) {
      if (s.type === 'response') {
        map[s.promptIndex] = (map[s.promptIndex] ?? '') + s.text;
      }
    }
    return map;
  }, [segments]);
  // Track which prompt is currently streaming (highest promptIndex seen in segments)
  const currentPromptIndex = useMemo(() => {
    if (!isStreaming) return -1;
    let maxIdx = 0;
    for (const s of segments) {
      if (s.promptIndex > maxIdx) maxIdx = s.promptIndex;
    }
    return maxIdx;
  }, [isStreaming, segments]);

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <ScrollArea className="flex-1 min-w-0">
        <div className="p-6">
          {/* Template variables (collapsible) */}
          <TemplateVariablesSection template={template} />

          {/* ── Comparison layout — all pins shown side-by-side ── */}
          {hasPins && (
            <ComparisonGrid
              pinnedRuns={pinnedRuns}
              activeCarouselIndex={activeCarouselIndex}
              setActiveCarouselIndex={setActiveCarouselIndex}
              onUnpin={onUnpin}
              onClearAllPins={onClearAllPins}
              onClearCurrentRun={onClearCurrentRun}
              hasCurrentRun={hasCurrentRun}
              isStreaming={isStreaming}
              segments={segments}
              copiedIndex={copiedIndex}
              handleCopy={handleCopy}
              currentJudgeScores={currentJudgeScores}
              currentVersionLabel={currentVersionLabel}
            />
          )}

          {/* Streaming indicator (non-comparison mode) */}
          {!hasPins && isStreaming && (
            <StreamingIndicator
              responseAreaRef={responseAreaRef}
              firstTokenReceived={firstTokenReceived}
              elapsedSeconds={elapsedSeconds}
              approxOutputTokens={approxOutputTokens}
            />
          )}

          {/* Error */}
          {error && (
            <PlaygroundErrorDisplay
              error={error}
              rateLimitCountdown={rateLimitCountdown}
              isStreaming={isStreaming}
              onRetry={handleRun}
            />
          )}

          {/* ── Chain view (multi-prompt) — hidden when comparing ── */}
          {!hasPins && isChain && (hasResponses || isStreaming) && (
            <ChainView
              prompts={prompts}
              segments={segments}
              streamedResponses={streamedResponses}
              currentPromptIndex={currentPromptIndex}
              isStreaming={isStreaming}
              responseCount={responseCount}
              copiedIndex={copiedIndex}
              handleCopy={handleCopy}
              fieldValues={fieldValues}
            />
          )}

          {/* ── Single prompt view — hidden when comparing ── */}
          {!hasPins && !isChain && (hasResponses || isStreaming) && (
            <div className="space-y-2">
              <SegmentTimeline
                segments={segments}
                isStreaming={isStreaming}
                copiedIndex={copiedIndex}
                handleCopy={handleCopy}
              />
              {segments.length === 0 && isStreaming && (
                <div className="rounded-lg border border-border-subtle bg-surface/50 p-4">
                  <div className="h-6 w-2/3 rounded bg-foreground-muted/10 animate-pulse" />
                </div>
              )}
            </div>
          )}

          {/* Generation stopped indicator */}
          {wasStopped && !isStreaming && hasResponses && (
            <div className="flex items-center gap-2 text-xs text-foreground-muted mt-2 pt-2 border-t border-dashed border-border-subtle">
              <Square className="size-3" />
              <span>Generation stopped</span>
            </div>
          )}

          {/* Judge output quality (non-comparison mode) */}
          {!hasPins && !isStreaming && hasResponses && currentJudgeScores && (
            <JudgeScorePanel scores={currentJudgeScores} />
          )}

          {/* Empty state */}
          {!hasResponses && !error && (
            <div
              className={`flex flex-col items-center justify-center py-20 text-foreground-muted transition-opacity duration-200 ${isStreaming ? 'opacity-0' : 'opacity-100'}`}
            >
              <Play className="size-10 mb-4 opacity-20" />
              <p className="text-sm">Click Run to test your prompt</p>
              {isChain && (
                <p className="text-xs mt-1">{prompts.length} prompts will execute sequentially</p>
              )}
            </div>
          )}

          {/* Run summary bar */}
          {!isStreaming && hasResponses && (elapsedSeconds > 0 || lastTokens) && (
            <div className="flex items-center gap-4 text-xs text-foreground-muted mt-4 pt-3 border-t border-border-subtle">
              {elapsedSeconds > 0 && <span>{elapsedSeconds}s</span>}
              {lastTokens?.input != null && <span>{lastTokens.input.toLocaleString()} input</span>}
              {lastTokens?.output != null && (
                <span>{lastTokens.output.toLocaleString()} output</span>
              )}
              {!hasPins && currentJudgeScores && (
                <>
                  <span className="text-border-subtle">·</span>
                  <span className={scoreColor(currentJudgeScores.averageScore).text}>
                    {currentJudgeScores.averageScore.toFixed(1)}/10
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Run status bar — fixed at bottom, visible during generation and judging */}
      {(isStreaming || (isJudging && !currentJudgeScores)) && (
        <div className="flex items-center justify-center gap-3 px-6 py-3 bg-elevated border-t border-border-subtle shrink-0">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-base text-foreground">
            {isJudging ? 'Evaluating quality...' : 'Generating response...'}
          </span>
          <span className="text-base text-foreground-muted">{elapsedSeconds}s</span>
        </div>
      )}
    </div>
  );
}
