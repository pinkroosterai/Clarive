import { Loader2, Pin, PinOff } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

import { ConversationView } from './ConversationView';
import { JudgeScorePanel } from './JudgeScorePanel';
import { ScoreBadgeBar } from './ScoreBadgeBar';
import { SegmentTimeline } from './SegmentTimeline';

import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { StreamSegment } from '@/hooks/usePlaygroundStreaming';
import type { Evaluation, TestRunResponse } from '@/services/api/playgroundService';

interface ComparisonGridProps {
  pinnedRuns: TestRunResponse[];
  activeCarouselIndex: number;
  setActiveCarouselIndex: React.Dispatch<React.SetStateAction<number>>;
  onUnpin: (runId: string) => void;
  onClearAllPins: () => void;
  onClearCurrentRun?: () => void;
  hasCurrentRun: boolean;
  isStreaming: boolean;
  segments: StreamSegment[];
  copiedIndex: number | null;
  handleCopy: (text: string, index: number) => Promise<void>;
  currentJudgeScores: Evaluation | null;
  currentVersionLabel: string | null;
}

export function ComparisonGrid({
  pinnedRuns,
  activeCarouselIndex,
  setActiveCarouselIndex,
  onUnpin,
  onClearAllPins,
  onClearCurrentRun,
  hasCurrentRun,
  isStreaming,
  segments,
  copiedIndex,
  handleCopy,
  currentJudgeScores,
  currentVersionLabel,
}: ComparisonGridProps) {
  const clampedPinIndex = Math.min(activeCarouselIndex, Math.max(pinnedRuns.length - 1, 0));
  const [showPrompts, setShowPrompts] = useState(false);

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

  // Scroll active pin column into view when index changes
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

  const totalColumns = (hasCurrentRun ? 1 : 0) + pinnedRuns.length;
  const needsScroll = totalColumns > 2;

  return (
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
        currentRunScore={hasCurrentRun ? (currentJudgeScores?.averageScore ?? null) : undefined}
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
      {(hasCurrentRun || pinnedRuns.some((r) => r.renderedPrompts || r.renderedSystemMessage)) && (
        <button
          onClick={() => setShowPrompts((p) => !p)}
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          {showPrompts ? 'Hide prompts' : 'Show prompts'}
        </button>
      )}

      {/* Grid column container */}
      <ScrollArea ref={scrollContainerRef}>
        <div>
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
                    <span className="text-foreground-muted/60">t={run.temperature.toFixed(1)}</span>
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
  );
}
