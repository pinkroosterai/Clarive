import { Play, Square, Copy, Check, Loader2, Pin, PinOff } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { CollapsedPrompt, ConversationView } from './ConversationView';
import CopyButton from './CopyButton';
import { JudgeScorePanel } from './JudgeScorePanel';
import { PlaygroundErrorDisplay } from './PlaygroundErrorDisplay';
import { ScoreBadgeBar } from './ScoreBadgeBar';
import { SegmentTimeline } from './SegmentTimeline';
import { StreamingIndicator } from './StreamingIndicator';
import { TemplateVariablesSection } from './TemplateVariablesSection';
import type {
  PlaygroundStreamingState,
  PlaygroundComparisonState,
  PlaygroundTemplateState,
  PlaygroundJudgeState,
} from './utils';

import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { scoreColor } from '@/components/wizard/scoreUtils';
import { renderTemplate } from '@/lib/templateRenderer';
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
  const [showPrompts, setShowPrompts] = useState(false);

  const hasCurrentRun = hasResponses || isStreaming;
  const clampedPinIndex = Math.min(activeCarouselIndex, Math.max(pinnedRuns.length - 1, 0));

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

  // ── Keyboard navigation for pinned runs ──
  const comparisonRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const handleComparisonKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (pinnedRuns.length <= 1) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveCarouselIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveCarouselIndex((prev) => Math.min(prev + 1, pinnedRuns.length - 1));
      }
    },
    [pinnedRuns.length, setActiveCarouselIndex]
  );

  // Scroll active pin column into view when index changes (horizontal only — no vertical scroll)
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const viewport = scrollContainerRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;
    const target = scrollContainerRef.current.querySelector(
      `[data-pin-index="${clampedPinIndex}"]`
    );
    if (!target) return;
    const targetLeft = (target as HTMLElement).offsetLeft;
    const viewportWidth = viewport.clientWidth;
    const targetWidth = (target as HTMLElement).offsetWidth;
    const scrollLeft = targetLeft - (viewportWidth - targetWidth) / 2;
    viewport.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
  }, [clampedPinIndex]);

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <ScrollArea className="flex-1 min-w-0">
        <div className="p-6">
          {/* Template variables (collapsible) */}
          <TemplateVariablesSection template={template} />

          {/* ── Comparison layout — all pins shown side-by-side ── */}
          {hasPins && (
            <div
              ref={comparisonRef}
              className="mb-6 space-y-3 outline-none"
              tabIndex={0}
              onKeyDown={handleComparisonKeyDown}
              aria-label={`Pinned run comparison. ${pinnedRuns.length > 1 ? 'Use left and right arrow keys to navigate.' : ''}`}
              role="region"
            >
              {/* Score badge bar */}
              <ScoreBadgeBar
                pinnedRuns={pinnedRuns}
                activePinIndex={clampedPinIndex}
                onSelectIndex={setActiveCarouselIndex}
                currentRunScore={
                  hasCurrentRun ? (currentJudgeScores?.averageScore ?? null) : undefined
                }
                currentRunVersionLabel={hasCurrentRun ? currentVersionLabel : undefined}
                onClearAll={onClearAllPins}
                onScrollToCurrent={() => {
                  setActiveCarouselIndex(-1);
                  const viewport = scrollContainerRef.current?.querySelector(
                    '[data-radix-scroll-area-viewport]'
                  );
                  viewport?.scrollTo({ left: 0, behavior: 'smooth' });
                }}
                onUnpin={onUnpin}
                onClearCurrentRun={onClearCurrentRun}
              />

              {/* Show prompt toggle */}
              {(hasCurrentRun ||
                pinnedRuns.some((r) => r.renderedPrompts || r.renderedSystemMessage)) && (
                <button
                  onClick={() => setShowPrompts((p) => !p)}
                  className="text-xs text-foreground-muted hover:text-foreground transition-colors"
                >
                  {showPrompts ? 'Hide prompts' : 'Show prompts'}
                </button>
              )}

              {/* Grid column container — rows align headers, responses, and scores */}
              {(() => {
                const totalColumns = (hasCurrentRun ? 1 : 0) + pinnedRuns.length;
                const needsScroll = totalColumns > 2;

                return (
                  <ScrollArea ref={scrollContainerRef}>
                    <div>
                      {/* 3-row grid: [header] [responses] [scores] */}
                      <div
                        className="grid gap-x-4 gap-y-3"
                        style={{
                          gridTemplateColumns: needsScroll
                            ? `repeat(${totalColumns}, minmax(50%, 1fr))`
                            : `repeat(${totalColumns}, minmax(0, 1fr))`,
                          gridTemplateRows: 'auto 1fr auto',
                        }}
                      >
                        {/* ── Row 1: Column headers ── */}
                        {hasCurrentRun && (
                          <div className="text-xs font-medium text-foreground-muted flex items-center gap-1.5">
                            {isStreaming && <Loader2 className="size-3 animate-spin" />}
                            <span>Current Run</span>
                          </div>
                        )}
                        {pinnedRuns.map((run, pinIndex) => (
                          <div key={`header-${run.id}`} data-pin-index={pinIndex}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
                                <Pin className="size-3 text-primary" />
                                <span className="font-medium">{run.model}</span>
                                {run.versionLabel && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-elevated">
                                    {run.versionLabel}
                                  </span>
                                )}
                                <span className="text-foreground-muted/60">
                                  t={run.temperature.toFixed(1)}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5"
                                onClick={() => onUnpin(run.id)}
                                title="Unpin"
                                aria-label={`Unpin ${run.model}`}
                              >
                                <PinOff className="size-3 text-primary" />
                              </Button>
                            </div>
                            <div className="text-[10px] text-foreground-muted">
                              {new Date(run.createdAt).toLocaleString()}
                            </div>
                          </div>
                        ))}

                        {/* ── Row 2: Response content ── */}
                        {hasCurrentRun && (
                          <div className="space-y-2 self-start min-w-0">
                            <SegmentTimeline
                              segments={segments}
                              isStreaming={isStreaming}
                              copiedIndex={copiedIndex}
                              handleCopy={handleCopy}
                              copyIndexOffset={2000}
                            />
                            {segments.length === 0 && isStreaming && (
                              <span className="text-xs text-foreground-muted">—</span>
                            )}
                          </div>
                        )}

                        {pinnedRuns.map((run) => (
                          <div key={`content-${run.id}`} className="space-y-2 self-start">
                            {run.conversationLog?.length ? (
                              <ConversationView
                                messages={run.conversationLog}
                                copiedIndex={copiedIndex}
                                onCopy={handleCopy}
                              />
                            ) : (
                              <div className="text-xs text-foreground-muted p-4">
                                No conversation data available for this run.
                              </div>
                            )}
                          </div>
                        ))}

                        {/* ── Row 3: Judge scores ── */}
                        {hasCurrentRun && (
                          <div className="self-start min-w-0">
                            {!isStreaming && currentJudgeScores && (
                              <JudgeScorePanel scores={currentJudgeScores} />
                            )}
                          </div>
                        )}
                        {pinnedRuns.map((run) => (
                          <div key={`scores-${run.id}`} className="self-start min-w-0">
                            {run.judgeScores && <JudgeScorePanel scores={run.judgeScores} />}
                          </div>
                        ))}
                      </div>
                    </div>
                    {needsScroll && <ScrollBar orientation="horizontal" />}
                  </ScrollArea>
                );
              })()}

              {/* Navigation dots */}
              {(hasCurrentRun ? pinnedRuns.length >= 1 : pinnedRuns.length > 1) && (
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  {hasCurrentRun && (
                    <button
                      onClick={() => {
                        setActiveCarouselIndex(-1);
                        const viewport = scrollContainerRef.current?.querySelector(
                          '[data-radix-scroll-area-viewport]'
                        );
                        viewport?.scrollTo({ left: 0, behavior: 'smooth' });
                      }}
                      className={`size-2 rounded-full transition-colors ${
                        clampedPinIndex === -1
                          ? 'bg-primary'
                          : 'bg-border-subtle hover:bg-foreground-muted/40'
                      }`}
                      aria-label="View current run"
                    />
                  )}
                  {pinnedRuns.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveCarouselIndex(i)}
                      className={`size-2 rounded-full transition-colors ${
                        i === clampedPinIndex
                          ? 'bg-primary'
                          : 'bg-border-subtle hover:bg-foreground-muted/40'
                      }`}
                      aria-label={`View pinned run ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
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
            <div className="space-y-0">
              {prompts.map((prompt, i) => {
                const response = streamedResponses[i];
                const isActive = isStreaming && i === currentPromptIndex;
                const isComplete =
                  response !== undefined && (!isStreaming || i < currentPromptIndex);

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
          )}

          {/* Copy all for chains */}
          {!hasPins && !isStreaming && isChain && responseCount >= 2 && (
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
