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
  X,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback, type RefObject } from 'react';

import { ConversationView } from './ConversationView';
import CopyButton from './CopyButton';
import { ToolCallBlock } from './ToolCallBlock';
import ReasoningBlock from './ReasoningBlock';

import LLMResponseBlock from '@/components/editor/LLMResponseBlock';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { scoreColor } from '@/components/wizard/scoreUtils';
import { getStreamingStatusMessage } from '@/hooks/usePlaygroundStreaming';
import { mapPlaygroundError, isRateLimitError } from '@/lib/playgroundErrors';
import { renderTemplate } from '@/lib/templateRenderer';
import type {
  TestRunResponse,
  TestRunPromptResponse,
  Evaluation,
} from '@/services/api/playgroundService';
import type { TemplateField } from '@/types';

interface Prompt {
  content: string;
}

// Fixed order so score rows align across comparison columns
const DIMENSION_ORDER = ['Accuracy', 'Helpfulness', 'Relevance', 'Coherence', 'Safety'];

function JudgeScorePanel({ scores }: { scores: Evaluation }) {
  const sortedDimensions = Object.entries(scores.dimensions).sort(([a], [b]) => {
    const ai = DIMENSION_ORDER.indexOf(a);
    const bi = DIMENSION_ORDER.indexOf(b);
    // Known dimensions in canonical order, unknown ones at the end alphabetically
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="mt-4 pt-3 border-t border-border-subtle space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-8 rounded-full border-2 border-primary">
          <span className="text-xs font-bold text-primary">{scores.averageScore.toFixed(1)}</span>
        </div>
        <span className="text-xs text-foreground-muted">Output Quality</span>
      </div>
      <div className="space-y-1.5">
        {sortedDimensions.map(([dim, entry]) => {
          const { bar, text } = scoreColor(entry.score);
          return (
            <div key={dim} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground-muted w-20 shrink-0">{dim}</span>
                <div className="flex-1 h-1.5 rounded-full bg-elevated">
                  <div
                    className={`h-1.5 rounded-full ${bar}`}
                    style={{ width: `${(entry.score / 10) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-medium w-4 text-right ${text}`}>{entry.score}</span>
              </div>
              {entry.feedback && (
                <p className="text-[11px] text-foreground-muted pl-[calc(5rem+0.5rem)] leading-snug">
                  {entry.feedback}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Score badge bar for carousel navigation ──

function ScoreBadgeBar({
  pinnedRuns,
  activePinIndex,
  onSelectIndex,
  currentRunScore,
  currentRunVersionLabel,
  onClearAll,
  onScrollToCurrent,
  onUnpin,
  onClearCurrentRun,
}: {
  pinnedRuns: TestRunResponse[];
  activePinIndex: number;
  onSelectIndex: (index: number) => void;
  currentRunScore?: number | null;
  currentRunVersionLabel?: string | null;
  onClearAll?: () => void;
  onScrollToCurrent?: () => void;
  onUnpin?: (runId: string) => void;
  onClearCurrentRun?: () => void;
}) {
  const showCurrentPill = currentRunScore !== undefined;
  const currentColor = currentRunScore != null ? scoreColor(currentRunScore) : null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showCurrentPill && (
        <div
          className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs transition-all duration-150 ${
            activePinIndex === -1
              ? 'bg-primary/10 border border-primary/30 ring-2 ring-primary'
              : 'bg-primary/10 border border-primary/30 hover:bg-primary/20'
          }`}
        >
          <button onClick={onScrollToCurrent} className="inline-flex items-center gap-1.5 cursor-pointer" title="Scroll to current run">
            <span className="font-medium">Current Run</span>
            {currentRunVersionLabel && (
              <span className="text-[10px] font-medium text-foreground-muted">
                {currentRunVersionLabel}
              </span>
            )}
            {currentRunScore != null && (
              <span className={`font-bold tabular-nums ${currentColor?.text ?? ''}`}>
                {currentRunScore.toFixed(1)}
              </span>
            )}
          </button>
          {onClearCurrentRun && (
            <button
              onClick={(e) => { e.stopPropagation(); onClearCurrentRun(); }}
              className="p-0.5 rounded-full text-foreground-muted hover:text-foreground hover:bg-primary/20 transition-colors cursor-pointer"
              aria-label="Remove current run from comparison"
              title="Remove from comparison"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}
      {pinnedRuns.map((run, i) => {
        const isActive = activePinIndex >= 0 && i === activePinIndex;
        const score = run.judgeScores?.averageScore;
        const color = score !== undefined ? scoreColor(score) : null;
        return (
          <div
            key={run.id}
            className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs transition-all duration-150 ${
              isActive
                ? 'bg-elevated ring-2 ring-primary'
                : 'bg-elevated hover:bg-elevated/80'
            }`}
          >
            <button
              onClick={() => onSelectIndex(i)}
              className="inline-flex items-center gap-1.5 cursor-pointer"
              title={`View: ${run.model}`}
              aria-label={`View ${run.model}${score !== undefined ? `, score ${score.toFixed(1)}` : ''}`}
            >
              <span className="truncate max-w-[100px] font-medium" title={run.model}>{run.model}</span>
              {run.versionLabel && (
                <span className="text-[10px] font-medium text-foreground-muted">
                  {run.versionLabel}
                </span>
              )}
              {score !== undefined && (
                <span className={`font-bold tabular-nums ${color?.text ?? ''}`}>
                  {score.toFixed(1)}
                </span>
              )}
            </button>
            {onUnpin && (
              <button
                onClick={(e) => { e.stopPropagation(); onUnpin(run.id); }}
                className="p-0.5 rounded-full text-foreground-muted hover:text-foreground hover:bg-elevated/60 transition-colors cursor-pointer"
                aria-label={`Unpin ${run.model}`}
                title="Remove from comparison"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        );
      })}
      {onClearAll && pinnedRuns.length > 1 && (
        <button
          onClick={onClearAll}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-foreground-muted hover:text-foreground hover:bg-elevated/80 transition-colors"
          aria-label="Clear all pinned runs"
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </div>
  );
}

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
  prompts: Prompt[];
  isChain: boolean;
  // Streaming state
  isStreaming: boolean;
  firstTokenReceived: boolean;
  streamedResponses: Record<number, string>;
  streamedReasoning: Record<number, string>;
  error: string | null;
  wasStopped: boolean;
  rateLimitCountdown: number;
  elapsedSeconds: number;
  approxOutputTokens: number;
  lastTokens: { input: number | null; output: number | null } | null;
  hasResponses: boolean;
  currentPromptIndex: number;
  responseCount: number;
  responseAreaRef: RefObject<HTMLDivElement | null>;
  // Template state
  templateFields: TemplateField[];
  fieldValues: Record<string, string>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  // Comparison state
  pinnedRuns: TestRunResponse[];
  onUnpin: (runId: string) => void;
  onClearAllPins: () => void;
  activeCarouselIndex: number;
  setActiveCarouselIndex: React.Dispatch<React.SetStateAction<number>>;
  // UI state
  expandedStepInputs: Set<number>;
  setExpandedStepInputs: React.Dispatch<React.SetStateAction<Set<number>>>;
  copiedIndex: number | null;
  // Handlers
  handleRun: () => void;
  handleCopy: (text: string, index: number) => Promise<void>;
  // Judge
  currentJudgeScores: Evaluation | null;
  isJudging: boolean;
  // Version
  currentVersionLabel: string | null;
  // Fill template fields
  onFillTemplateFields?: () => void;
  isFillingTemplateFields?: boolean;
  // Clear current run from comparison
  onClearCurrentRun?: () => void;
  // Tool calls (streaming)
  toolCalls?: Record<string, { toolName: string; arguments: string | null; response: string | null; durationMs: number | null; error: string | null; status: 'calling' | 'complete' | 'error' }>;
  // Conversation log (completed run)
  conversationLog?: import('./ConversationView').ConversationMessage[] | null;
}

export default function PlaygroundResultsArea({
  prompts,
  isChain,
  isStreaming,
  firstTokenReceived,
  streamedResponses,
  streamedReasoning,
  error,
  wasStopped,
  rateLimitCountdown,
  elapsedSeconds,
  approxOutputTokens,
  lastTokens,
  hasResponses,
  currentPromptIndex,
  responseCount,
  responseAreaRef,
  templateFields,
  fieldValues,
  setFieldValues,
  pinnedRuns,
  onUnpin,
  onClearAllPins,
  activeCarouselIndex,
  setActiveCarouselIndex,
  expandedStepInputs,
  setExpandedStepInputs,
  copiedIndex,
  handleRun,
  handleCopy,
  currentJudgeScores,
  isJudging,
  currentVersionLabel,
  onFillTemplateFields,
  isFillingTemplateFields,
  onClearCurrentRun,
  toolCalls,
  conversationLog,
}: PlaygroundResultsAreaProps) {
  const hasPins = pinnedRuns.length > 0;
  const [showPrompts, setShowPrompts] = useState(false);

  const hasCurrentRun = hasResponses || isStreaming;
  const clampedPinIndex = Math.min(activeCarouselIndex, Math.max(pinnedRuns.length - 1, 0));

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
    ) as HTMLElement | null;
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
            <Collapsible defaultOpen open={missingCount > 0 ? true : undefined} className="mb-6">
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
                              setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
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
            currentRunScore={hasCurrentRun ? (currentJudgeScores?.averageScore ?? null) : undefined}
            currentRunVersionLabel={hasCurrentRun ? currentVersionLabel : undefined}
            onClearAll={onClearAllPins}
            onScrollToCurrent={() => {
              setActiveCarouselIndex(-1);
              const viewport = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]');
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

                  {/* ── Row 2: Response content (stretches to tallest) ── */}
                  {hasCurrentRun && (
                    <div className="space-y-3 self-start min-w-0">
                      {/* Completed run: use ConversationView for correct chronological order */}
                      {!isStreaming && conversationLog && conversationLog.length > 0 ? (
                        <ConversationView messages={conversationLog} />
                      ) : (
                        /* Streaming: use per-prompt rendering with live chunks */
                        prompts.map((_p, i) => {
                          const renderedContent = renderTemplate(_p.content, fieldValues);
                          return (
                            <div key={i}>
                              {showPrompts && (
                                <div className="bg-elevated/30 rounded-md p-3 border border-border-subtle mb-3">
                                  {(prompts.length > 1) && (
                                    <div className="text-[10px] font-semibold text-foreground-muted mb-1 uppercase tracking-wider">
                                      Prompt {i + 1}
                                    </div>
                                  )}
                                  <div className="text-xs font-mono whitespace-pre-wrap text-foreground-muted max-h-32 overflow-y-auto scrollbar-themed">
                                    {renderedContent}
                                  </div>
                                </div>
                              )}
                              {!showPrompts && prompts.length > 1 && (
                                <div className="text-xs text-foreground-muted mb-2">Prompt {i + 1}</div>
                              )}
                              {streamedReasoning[i] && (
                                <ReasoningBlock
                                  reasoning={streamedReasoning[i]}
                                  isStreaming={isStreaming}
                                />
                              )}
                              {i === 0 && toolCalls && Object.keys(toolCalls).length > 0 && (
                                <div className="space-y-1 my-2">
                                  {Object.entries(toolCalls).map(([callId, tc]) => (
                                    <ToolCallBlock
                                      key={callId}
                                      toolName={tc.toolName}
                                      arguments={tc.arguments}
                                      response={tc.response}
                                      durationMs={tc.durationMs}
                                      error={tc.error}
                                      status={tc.status}
                                    />
                                  ))}
                                </div>
                              )}
                              <div className="relative group rounded-lg border border-border-subtle bg-surface p-4">
                                {streamedResponses[i] !== undefined ? (
                                  <LLMResponseBlock
                                    output={streamedResponses[i]}
                                    isStreaming={isStreaming}
                                  />
                                ) : (
                                  <span className="text-xs text-foreground-muted">—</span>
                                )}
                                {streamedResponses[i] && !isStreaming && (
                                  <CopyButton
                                    text={streamedResponses[i]}
                                    index={2000 + i}
                                    copiedIndex={copiedIndex}
                                    onCopy={handleCopy}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })
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
                    const viewport = scrollContainerRef.current?.querySelector('[data-radix-scroll-area-viewport]');
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
            const isComplete = response !== undefined && (!isStreaming || i < currentPromptIndex);
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

                  {/* Reasoning output */}
                  {streamedReasoning[i] && (
                    <ReasoningBlock reasoning={streamedReasoning[i]} isStreaming={isActive} />
                  )}

                  {/* Response */}
                  {response !== undefined ? (
                    <div className="relative group">
                      <div
                        className={`rounded-lg border p-4 ${
                          isActive
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-border-subtle bg-surface'
                        }`}
                      >
                        <LLMResponseBlock output={response || ''} isStreaming={isActive ?? false} />
                      </div>

                      {!isStreaming && response && (
                        <CopyButton
                          text={response}
                          index={i}
                          copiedIndex={copiedIndex}
                          onCopy={handleCopy}
                        />
                      )}
                    </div>
                  ) : isStreaming && i === responseCount ? (
                    <div className="rounded-lg border border-border-subtle bg-surface/50 p-4">
                      <div className="h-6 w-2/3 rounded bg-foreground-muted/10 animate-pulse" />
                    </div>
                  ) : null}
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
          {prompts.map((_prompt, i) => {
            const response = streamedResponses[i];
            if (response === undefined && !isStreaming) return null;

            return (
              <div key={i}>
                {streamedReasoning[i] && (
                  <ReasoningBlock reasoning={streamedReasoning[i]} isStreaming={isStreaming} />
                )}

                <div className="relative group">
                  <div className="rounded-lg border border-border-subtle bg-surface p-4">
                    {response !== undefined ? (
                      <LLMResponseBlock output={response || ''} isStreaming={isStreaming} />
                    ) : (
                      <div className="h-6 w-2/3 rounded bg-foreground-muted/10 animate-pulse" />
                    )}
                  </div>

                  {response && !isStreaming && (
                    <CopyButton
                      text={response}
                      index={i}
                      copiedIndex={copiedIndex}
                      onCopy={handleCopy}
                    />
                  )}
                </div>
              </div>
            );
          })}
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
          {lastTokens?.input != null && (
            <span>{lastTokens.input.toLocaleString()} input</span>
          )}
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
