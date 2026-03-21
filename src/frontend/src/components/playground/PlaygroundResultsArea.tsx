import {
  Play,
  Square,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  Pin,
  PinOff,
  Sparkles,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { ConversationView } from './ConversationView';
import CopyButton from './CopyButton';
import { JudgeScorePanel } from './JudgeScorePanel';
import ReasoningBlock from './ReasoningBlock';
import { ScoreBadgeBar } from './ScoreBadgeBar';
import { ToolCallBlock } from './ToolCallBlock';
import type {
  PlaygroundStreamingState,
  PlaygroundComparisonState,
  PlaygroundTemplateState,
  PlaygroundJudgeState,
} from './utils';

import LLMResponseBlock from '@/components/editor/LLMResponseBlock';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { scoreColor } from '@/components/wizard/scoreUtils';
import { getStreamingStatusMessage } from '@/hooks/usePlaygroundStreaming';
import { mapPlaygroundError, isRateLimitError } from '@/lib/playgroundErrors';
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
  expandedStepInputs: Set<number>;
  setExpandedStepInputs: React.Dispatch<React.SetStateAction<Set<number>>>;
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
  expandedStepInputs,
  setExpandedStepInputs,
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
  const {
    templateFields,
    fieldValues,
    setFieldValues,
    onFillTemplateFields,
    isFillingTemplateFields,
  } = template;
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
    // Scroll horizontally within the ScrollArea viewport without affecting window scroll
    const targetLeft = target.offsetLeft;
    const viewportWidth = viewport.clientWidth;
    const targetWidth = target.offsetWidth;
    const scrollLeft = targetLeft - (viewportWidth - targetWidth) / 2;
    viewport.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
  }, [clampedPinIndex]);

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <ScrollArea className="flex-1 min-w-0">
        <div className="p-6">
          {/* Template variables (collapsible) */}
          {templateFields.length > 0 &&
            (() => {
              const missingCount = templateFields.filter((f) => !fieldValues[f.name]).length;
              return (
                <Collapsible
                  defaultOpen
                  open={missingCount > 0 ? true : undefined}
                  className="mb-6"
                >
                  <div className="flex items-center justify-between mb-2">
                    <CollapsibleTrigger className="group flex items-center gap-2 text-xs font-medium text-foreground-muted">
                      <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                      Template Variables ({templateFields.length})
                      {missingCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
                          {missingCount} required
                        </span>
                      )}
                    </CollapsibleTrigger>
                    {onFillTemplateFields && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1"
                        onClick={onFillTemplateFields}
                        disabled={isFillingTemplateFields}
                        aria-busy={isFillingTemplateFields}
                        aria-label="Fill template fields with AI-generated examples"
                      >
                        {isFillingTemplateFields ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Sparkles className="size-3" />
                        )}
                        {isFillingTemplateFields ? 'Generating...' : 'Fill with examples'}
                      </Button>
                    )}
                  </div>
                  <CollapsibleContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {templateFields.map((field) => {
                        const isEmpty = !fieldValues[field.name];
                        return (
                          <div key={field.name} className="space-y-1">
                            <Label className="text-xs font-mono">{`{{${field.name}}}`}</Label>
                            {field.type === 'enum' && field.enumValues.length > 0 ? (
                              <Select
                                value={fieldValues[field.name] || ''}
                                onValueChange={(v) =>
                                  setFieldValues((prev) => ({ ...prev, [field.name]: v }))
                                }
                              >
                                <SelectTrigger
                                  className={`h-8 text-xs ${isEmpty ? 'border-destructive' : ''}`}
                                >
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {field.enumValues.map((v) => (
                                    <SelectItem key={v} value={v} className="text-xs">
                                      {v}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (field.type === 'int' || field.type === 'float') &&
                              field.min !== null &&
                              field.max !== null ? (
                              <div className="flex items-center gap-2">
                                <Slider
                                  min={field.min}
                                  max={field.max}
                                  step={field.type === 'int' ? 1 : 0.01}
                                  value={[Number(fieldValues[field.name]) || field.min]}
                                  onValueChange={([v]) =>
                                    setFieldValues((prev) => ({ ...prev, [field.name]: String(v) }))
                                  }
                                  className="flex-1"
                                />
                                <span className="text-xs text-foreground-muted tabular-nums w-10 text-right">
                                  {fieldValues[field.name] || field.min}
                                </span>
                              </div>
                            ) : (
                              <Input
                                value={fieldValues[field.name] || ''}
                                onChange={(e) =>
                                  setFieldValues((prev) => ({
                                    ...prev,
                                    [field.name]: e.target.value,
                                  }))
                                }
                                placeholder={field.type !== 'string' ? field.type : 'value'}
                                className={`h-8 text-xs ${isEmpty ? 'border-destructive' : ''}`}
                                type={
                                  field.type === 'int' || field.type === 'float' ? 'number' : 'text'
                                }
                              />
                            )}
                            {isEmpty && <p className="text-xs text-destructive">Required</p>}
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })()}

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
                // Build columns: optional current run + all pinned runs (equal peers)
                const totalColumns = (hasCurrentRun ? 1 : 0) + pinnedRuns.length;
                const needsScroll = totalColumns > 2;

                return (
                  <ScrollArea ref={scrollContainerRef}>
                    <div>
                      {/* 3-row grid: [header] [responses] [scores] — each row stretches to tallest cell */}
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

                        {/* ── Row 2: Response content — unified segment timeline ── */}
                        {hasCurrentRun && (
                          <div className="space-y-2 self-start min-w-0">
                            {segments.map((seg, idx) => {
                              switch (seg.type) {
                                case 'reasoning':
                                  return (
                                    <ReasoningBlock
                                      key={`seg-${idx}`}
                                      reasoning={seg.text}
                                      isStreaming={isStreaming}
                                    />
                                  );
                                case 'tool_call': {
                                  // Find matching tool_result in segments
                                  const result = segments.find(
                                    (s) => s.type === 'tool_result' && s.callId === seg.callId
                                  );
                                  const toolResult =
                                    result?.type === 'tool_result' ? result : undefined;
                                  return (
                                    <ToolCallBlock
                                      key={`seg-${idx}`}
                                      toolName={seg.toolName}
                                      arguments={seg.arguments ?? null}
                                      response={toolResult?.response ?? null}
                                      durationMs={toolResult?.durationMs ?? null}
                                      error={toolResult?.error ?? null}
                                      status={
                                        toolResult
                                          ? toolResult.error
                                            ? 'error'
                                            : 'complete'
                                          : 'calling'
                                      }
                                    />
                                  );
                                }
                                case 'tool_result':
                                  return null; // Rendered as part of tool_call above
                                case 'response':
                                  return (
                                    <div
                                      key={`seg-${idx}`}
                                      className="relative group rounded-lg border border-border-subtle bg-surface p-4"
                                    >
                                      <LLMResponseBlock
                                        output={seg.text}
                                        isStreaming={isStreaming}
                                      />
                                      {!isStreaming && seg.text && (
                                        <CopyButton
                                          text={seg.text}
                                          index={2000 + idx}
                                          copiedIndex={copiedIndex}
                                          onCopy={handleCopy}
                                        />
                                      )}
                                    </div>
                                  );
                                default:
                                  return null;
                              }
                            })}
                            {segments.length === 0 && isStreaming && (
                              <span className="text-xs text-foreground-muted">—</span>
                            )}
                          </div>
                        )}

                        {pinnedRuns.map((run, pinIndex) => (
                          <div key={`content-${run.id}`} className="space-y-3 self-start">
                            {run.conversationLog?.length ? (
                              <ConversationView messages={run.conversationLog} />
                            ) : (
                              <div className="text-xs text-foreground-muted p-4">
                                No conversation data available for this run.
                              </div>
                            )}
                          </div>
                        ))}

                        {/* ── Row 3: Judge scores (aligned across columns) ── */}
                        {hasCurrentRun && (
                          <div className="self-start">
                            {!isStreaming && currentJudgeScores && (
                              <JudgeScorePanel scores={currentJudgeScores} />
                            )}
                          </div>
                        )}
                        {pinnedRuns.map((run) => (
                          <div key={`scores-${run.id}`} className="self-start">
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
            <div
              ref={responseAreaRef}
              className="flex items-center gap-2 text-sm text-foreground-muted mb-4"
              aria-live="polite"
              role="status"
            >
              {firstTokenReceived ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>
                    {getStreamingStatusMessage(elapsedSeconds)}{' '}
                    {elapsedSeconds > 0 && `${elapsedSeconds}s`}
                    {approxOutputTokens > 0 && (
                      <span className="text-foreground-muted/70 ml-1">
                        · ~{approxOutputTokens.toLocaleString()} tokens
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1">
                  Connecting{elapsedSeconds > 0 && ` ${elapsedSeconds}s`}
                  <span className="inline-flex gap-0.5">
                    <span className="size-1 rounded-full bg-foreground-muted animate-pulse" />
                    <span className="size-1 rounded-full bg-foreground-muted animate-pulse [animation-delay:200ms]" />
                    <span className="size-1 rounded-full bg-foreground-muted animate-pulse [animation-delay:400ms]" />
                  </span>
                </span>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              aria-live="assertive"
              className={`text-sm rounded-lg p-4 mb-4 flex items-center justify-between gap-3 ${
                isRateLimitError(error)
                  ? 'text-warning-text bg-warning-bg border border-warning-border'
                  : 'text-destructive bg-destructive/10'
              }`}
            >
              <div className="flex-1">
                <span>
                  {isRateLimitError(error) && rateLimitCountdown > 0
                    ? `Rate limit reached — you can try again in ${rateLimitCountdown}s`
                    : mapPlaygroundError(error)}
                </span>
                {isRateLimitError(error) && rateLimitCountdown > 0 && (
                  <div className="mt-2 h-1 rounded-full bg-warning-border/30 overflow-hidden">
                    <div
                      className="h-full bg-warning-text/60 rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${((60 - rateLimitCountdown) / 60) * 100}%` }}
                    />
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRun}
                disabled={isStreaming || rateLimitCountdown > 0}
                className="shrink-0"
              >
                {rateLimitCountdown > 0 ? `Retry in ${rateLimitCountdown}s` : 'Retry'}
              </Button>
            </div>
          )}

          {/* ── Chain view (multi-prompt) — hidden when comparing ── */}
          {!hasPins && isChain && (hasResponses || isStreaming) && (
            <div className="space-y-0">
              {prompts.map((prompt, i) => {
                const response = streamedResponses[i];
                const isActive = isStreaming && i === currentPromptIndex;
                const isComplete =
                  response !== undefined && (!isStreaming || i < currentPromptIndex);
                const showInput = expandedStepInputs.has(i);

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
                    <div className="flex-1 pb-6 min-w-0">
                      {/* Step header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-foreground-muted">
                          Prompt {i + 1}
                        </span>
                        <button
                          onClick={() =>
                            setExpandedStepInputs((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            })
                          }
                          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
                        >
                          {showInput ? 'Hide prompt' : 'Show prompt'}
                        </button>
                      </div>

                      {/* Prompt input (collapsed by default) */}
                      {showInput && (
                        <div className="bg-elevated/50 rounded-md p-3 text-xs font-mono mb-3 border border-border-subtle whitespace-pre-wrap max-h-32 overflow-y-auto scrollbar-themed">
                          {renderTemplate(prompt.content, fieldValues)}
                        </div>
                      )}

                      {/* Render segments chronologically for this prompt */}
                      {segments
                        .filter((s) => s.promptIndex === i)
                        .map((seg, idx) => {
                          switch (seg.type) {
                            case 'reasoning':
                              return (
                                <ReasoningBlock
                                  key={`chain-${i}-seg-${idx}`}
                                  reasoning={seg.text}
                                  isStreaming={isActive}
                                />
                              );
                            case 'tool_call': {
                              const result = segments.find(
                                (s) => s.type === 'tool_result' && s.callId === seg.callId
                              );
                              const toolResult =
                                result?.type === 'tool_result' ? result : undefined;
                              return (
                                <ToolCallBlock
                                  key={`chain-${i}-tool-${seg.callId}`}
                                  toolName={seg.toolName}
                                  arguments={seg.arguments ?? null}
                                  response={toolResult?.response ?? null}
                                  durationMs={toolResult?.durationMs ?? null}
                                  error={toolResult?.error ?? null}
                                  status={
                                    toolResult
                                      ? toolResult.error
                                        ? 'error'
                                        : 'complete'
                                      : 'calling'
                                  }
                                />
                              );
                            }
                            case 'tool_result':
                              return null; // Rendered as part of tool_call above
                            case 'response':
                              return (
                                <div key={`chain-${i}-seg-${idx}`} className="relative group">
                                  <div
                                    className={`rounded-lg border p-4 ${
                                      isActive
                                        ? 'border-primary/30 bg-primary/5'
                                        : 'border-border-subtle bg-surface'
                                    }`}
                                  >
                                    <LLMResponseBlock
                                      output={seg.text || ''}
                                      isStreaming={isActive}
                                    />
                                  </div>
                                  {!isStreaming && seg.text && (
                                    <CopyButton
                                      text={seg.text}
                                      index={i}
                                      copiedIndex={copiedIndex}
                                      onCopy={handleCopy}
                                    />
                                  )}
                                </div>
                              );
                            default:
                              return null;
                          }
                        })}
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
            <div className="space-y-3">
              {/* Render segments in chronological order for single-prompt view */}
              {segments.map((seg, idx) => {
                switch (seg.type) {
                  case 'reasoning':
                    return (
                      <ReasoningBlock
                        key={`seg-${idx}`}
                        reasoning={seg.text}
                        isStreaming={isStreaming}
                      />
                    );
                  case 'tool_call': {
                    const result = segments.find(
                      (s) => s.type === 'tool_result' && s.callId === seg.callId
                    );
                    const toolResult = result?.type === 'tool_result' ? result : undefined;
                    return (
                      <ToolCallBlock
                        key={`seg-${idx}`}
                        toolName={seg.toolName}
                        arguments={seg.arguments ?? null}
                        response={toolResult?.response ?? null}
                        durationMs={toolResult?.durationMs ?? null}
                        error={toolResult?.error ?? null}
                        status={toolResult ? (toolResult.error ? 'error' : 'complete') : 'calling'}
                      />
                    );
                  }
                  case 'tool_result':
                    return null; // Rendered as part of tool_call above
                  case 'response':
                    return (
                      <div key={`seg-${idx}`} className="relative group">
                        <div className="rounded-lg border border-border-subtle bg-surface p-4">
                          <LLMResponseBlock output={seg.text} isStreaming={isStreaming} />
                        </div>
                        {!isStreaming && seg.text && (
                          <CopyButton
                            text={seg.text}
                            index={idx}
                            copiedIndex={copiedIndex}
                            onCopy={handleCopy}
                          />
                        )}
                      </div>
                    );
                  default:
                    return null;
                }
              })}
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
