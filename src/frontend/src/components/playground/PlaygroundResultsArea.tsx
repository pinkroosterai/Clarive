import {
  Play,
  Square,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Loader2,
  Pin,
  PinOff,
  Sparkles,
} from 'lucide-react';
import { useState, useEffect, type RefObject } from 'react';

import CopyButton from './CopyButton';
import ReasoningBlock from './ReasoningBlock';

import LLMResponseBlock from '@/components/editor/LLMResponseBlock';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getStreamingStatusMessage } from '@/hooks/usePlaygroundStreaming';
import { mapPlaygroundError, isRateLimitError } from '@/lib/playgroundErrors';
import { renderTemplate } from '@/lib/templateRenderer';
import { scoreColor } from '@/components/wizard/scoreUtils';
import type {
  TestRunResponse,
  TestRunPromptResponse,
  Evaluation,
} from '@/services/api/playgroundService';
import type { TemplateField } from '@/types';

interface Prompt {
  content: string;
}

function JudgeScorePanel({ scores }: { scores: Evaluation }) {
  return (
    <div className="mt-4 pt-3 border-t border-border-subtle space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center size-8 rounded-full border-2 border-primary">
          <span className="text-xs font-bold text-primary">{scores.averageScore.toFixed(1)}</span>
        </div>
        <span className="text-xs text-foreground-muted">Output Quality</span>
      </div>
      <div className="space-y-1.5">
        {Object.entries(scores.dimensions).map(([dim, entry]) => {
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
  activeCarouselIndex,
  onSelectIndex,
  referenceRunId,
  carouselOffset,
  currentRunScore,
}: {
  pinnedRuns: TestRunResponse[];
  activeCarouselIndex: number;
  onSelectIndex: (carouselIndex: number) => void;
  referenceRunId: string | null;
  carouselOffset: number; // number of pinnedRuns entries before carousel starts (0 or 1)
  currentRunScore?: number | null; // show a "Current Run" pill when set (even if null)
}) {
  const showCurrentPill = currentRunScore !== undefined;
  const currentColor = currentRunScore != null ? scoreColor(currentRunScore) : null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showCurrentPill && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary/10 border border-primary/30">
          <span className="font-medium">Current Run</span>
          {currentRunScore != null && (
            <span className={`font-bold tabular-nums ${currentColor?.text ?? ''}`}>
              {currentRunScore.toFixed(1)}
            </span>
          )}
        </span>
      )}
      {pinnedRuns.map((run, i) => {
        const isReference = run.id === referenceRunId;
        const carouselIndex = i - carouselOffset;
        const isActive = !isReference && carouselIndex === activeCarouselIndex;
        const score = run.judgeScores?.averageScore;
        const color = score !== undefined ? scoreColor(score) : null;
        return (
          <button
            key={run.id}
            onClick={() => {
              if (!isReference) onSelectIndex(carouselIndex);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all duration-150 ${
              isReference
                ? 'bg-primary/10 border border-primary/30 cursor-default'
                : isActive
                  ? 'bg-elevated ring-2 ring-primary cursor-pointer'
                  : 'bg-elevated hover:bg-elevated/80 cursor-pointer'
            }`}
            title={isReference ? 'Reference run' : `View: ${run.model}`}
          >
            <span className="truncate max-w-[100px] font-medium">{run.model}</span>
            {score !== undefined && (
              <span className={`font-bold tabular-nums ${color?.text ?? ''}`}>
                {score.toFixed(1)}
              </span>
            )}
          </button>
        );
      })}
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
          <div className="text-xs font-mono whitespace-pre-wrap text-foreground-muted max-h-32 overflow-y-auto">
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
  // Fill template fields
  onFillTemplateFields?: () => void;
  isFillingTemplateFields?: boolean;
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
  activeCarouselIndex,
  setActiveCarouselIndex,
  expandedStepInputs,
  setExpandedStepInputs,
  copiedIndex,
  handleRun,
  handleCopy,
  currentJudgeScores,
  isJudging,
  onFillTemplateFields,
  isFillingTemplateFields,
}: PlaygroundResultsAreaProps) {
  const hasPins = pinnedRuns.length > 0;
  const [showPrompts, setShowPrompts] = useState(false);

  // ── Carousel logic: reference column + navigable carousel ──
  // When current run exists: left = current run, carousel = all pins
  // When no current run: left = first pin (reference), carousel = remaining pins
  const hasCurrentRun = hasResponses || isStreaming;
  const referenceRun = !hasCurrentRun && hasPins ? pinnedRuns[0] : null;
  const carouselRuns = !hasCurrentRun && hasPins ? pinnedRuns.slice(1) : pinnedRuns;
  const clampedIndex = Math.min(activeCarouselIndex, Math.max(carouselRuns.length - 1, 0));
  const activeRun = carouselRuns[clampedIndex] ?? null;

  const judgeScores =
    (hasPins ? (referenceRun?.judgeScores ?? pinnedRuns[0]?.judgeScores) : null) ??
    currentJudgeScores;

  // ── Keyboard navigation for carousel ──
  useEffect(() => {
    if (!hasPins || carouselRuns.length <= 1) return;
    const handler = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveCarouselIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveCarouselIndex((prev) => Math.min(prev + 1, carouselRuns.length - 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasPins, carouselRuns.length, setActiveCarouselIndex]);

  return (
    <div className="flex-1 p-6">
      {/* Template variables (collapsible) */}
      {templateFields.length > 0 && (
        <Collapsible defaultOpen className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
              <ChevronDown className="size-3.5" />
              Template Variables ({templateFields.length})
            </CollapsibleTrigger>
            {onFillTemplateFields && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={onFillTemplateFields}
                disabled={isFillingTemplateFields}
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
                        type={field.type === 'int' || field.type === 'float' ? 'number' : 'text'}
                      />
                    )}
                    {isEmpty && <p className="text-xs text-destructive">Required</p>}
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Comparison layout — diff-view carousel */}
      {hasPins && (referenceRun || hasCurrentRun) && activeRun && (
        <div className="mb-6 space-y-3">
          {/* Score badge bar */}
          <ScoreBadgeBar
            pinnedRuns={pinnedRuns}
            activeCarouselIndex={clampedIndex}
            onSelectIndex={setActiveCarouselIndex}
            referenceRunId={referenceRun?.id ?? null}
            carouselOffset={referenceRun ? 1 : 0}
            currentRunScore={hasCurrentRun ? (currentJudgeScores?.averageScore ?? null) : undefined}
          />

          {/* Column headers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column header (reference) */}
            <div className="text-xs font-medium text-foreground-muted">
              {hasCurrentRun ? (
                <span className="flex items-center gap-1.5">
                  {isStreaming && <Loader2 className="size-3 animate-spin" />}
                  Current Run
                </span>
              ) : referenceRun ? (
                <span className="flex items-center gap-1.5">
                  <Pin className="size-3 text-primary" />
                  {referenceRun.model}
                  <span className="text-foreground-muted/60">
                    t={referenceRun.temperature.toFixed(1)}
                  </span>
                </span>
              ) : null}
            </div>
            {/* Right column header (carousel) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
                <Pin className="size-3 text-primary" />
                <span className="font-medium">{activeRun.model}</span>
                <span>t={activeRun.temperature.toFixed(1)}</span>
                <span>{new Date(activeRun.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1">
                {carouselRuns.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setActiveCarouselIndex((prev) => Math.max(prev - 1, 0))}
                      disabled={clampedIndex === 0}
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <span className="text-xs text-foreground-muted tabular-nums">
                      {clampedIndex + 1}/{carouselRuns.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() =>
                        setActiveCarouselIndex((prev) =>
                          Math.min(prev + 1, carouselRuns.length - 1)
                        )
                      }
                      disabled={clampedIndex === carouselRuns.length - 1}
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5"
                  onClick={() => onUnpin(activeRun.id)}
                  title="Unpin"
                >
                  <PinOff className="size-3 text-primary" />
                </Button>
              </div>
            </div>
          </div>

          {/* Show prompt toggle */}
          {(activeRun.renderedPrompts ||
            activeRun.renderedSystemMessage ||
            referenceRun?.renderedPrompts ||
            referenceRun?.renderedSystemMessage ||
            hasCurrentRun) && (
            <button
              onClick={() => setShowPrompts((p) => !p)}
              className="text-xs text-foreground-muted hover:text-foreground transition-colors"
            >
              {showPrompts ? 'Hide prompts' : 'Show prompts'}
            </button>
          )}

          {/* Collapsible prompt sections */}
          {showPrompts && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {hasCurrentRun ? (
                  <PromptSection
                    systemMessage={null}
                    renderedPrompts={prompts.map((p, i) => ({
                      promptIndex: i,
                      content: renderTemplate(p.content, fieldValues),
                    }))}
                  />
                ) : (
                  <PromptSection
                    systemMessage={referenceRun?.renderedSystemMessage}
                    renderedPrompts={referenceRun?.renderedPrompts}
                  />
                )}
              </div>
              <div className="animate-fade-in">
                <PromptSection
                  systemMessage={activeRun.renderedSystemMessage}
                  renderedPrompts={activeRun.renderedPrompts}
                />
              </div>
            </div>
          )}

          {/* Prompt response rows */}
          {prompts.map((_p, i) => {
            // Left column: current run response or reference pin response
            const leftResponse = hasCurrentRun
              ? streamedResponses[i]
              : referenceRun?.responses.find((r: TestRunPromptResponse) => r.promptIndex === i)
                  ?.content;
            // Right column: active carousel run response
            const rightResponse = activeRun.responses.find(
              (r: TestRunPromptResponse) => r.promptIndex === i
            );

            return (
              <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative group rounded-lg border border-border-subtle bg-surface p-4">
                  {prompts.length > 1 && (
                    <div className="text-xs text-foreground-muted mb-2">Prompt {i + 1}</div>
                  )}
                  {leftResponse !== undefined ? (
                    <LLMResponseBlock
                      output={leftResponse}
                      isStreaming={hasCurrentRun && isStreaming}
                    />
                  ) : (
                    <span className="text-xs text-foreground-muted">—</span>
                  )}
                  {leftResponse && !(hasCurrentRun && isStreaming) && (
                    <CopyButton
                      text={leftResponse}
                      index={2000 + i}
                      copiedIndex={copiedIndex}
                      onCopy={handleCopy}
                    />
                  )}
                </div>
                <div
                  key={activeRun.id}
                  className="relative group rounded-lg border border-border-subtle bg-surface p-4 animate-fade-in"
                >
                  {prompts.length > 1 && (
                    <div className="text-xs text-foreground-muted mb-2">Prompt {i + 1}</div>
                  )}
                  {rightResponse ? (
                    <LLMResponseBlock output={rightResponse.content} isStreaming={false} />
                  ) : (
                    <span className="text-xs text-foreground-muted">—</span>
                  )}
                  {rightResponse && (
                    <CopyButton
                      text={rightResponse.content}
                      index={3000 + i}
                      copiedIndex={copiedIndex}
                      onCopy={handleCopy}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Judge scores */}
          {((hasCurrentRun && !isStreaming && currentJudgeScores) ||
            referenceRun?.judgeScores ||
            activeRun.judgeScores) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                {hasCurrentRun
                  ? !isStreaming &&
                    currentJudgeScores && <JudgeScorePanel scores={currentJudgeScores} />
                  : referenceRun?.judgeScores && (
                      <JudgeScorePanel scores={referenceRun.judgeScores} />
                    )}
              </div>
              <div key={activeRun.id} className="animate-fade-in">
                {activeRun.judgeScores && <JudgeScorePanel scores={activeRun.judgeScores} />}
              </div>
            </div>
          )}

          {/* Dot indicators */}
          {carouselRuns.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {carouselRuns.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveCarouselIndex(i)}
                  className={`size-2 rounded-full transition-colors ${
                    i === clampedIndex
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

      {/* Pins with no carousel target (single pin, no current run) */}
      {hasPins && !hasCurrentRun && pinnedRuns.length === 1 && (
        <div className="mb-6 space-y-3">
          <ScoreBadgeBar
            pinnedRuns={pinnedRuns}
            activeCarouselIndex={0}
            onSelectIndex={() => {}}
            referenceRunId={pinnedRuns[0].id}
            carouselOffset={1}
          />
          <div className="text-xs font-medium text-foreground-muted flex items-center gap-1.5">
            <Pin className="size-3 text-primary" />
            {pinnedRuns[0].model}
            <span className="text-foreground-muted/60">
              t={pinnedRuns[0].temperature.toFixed(1)}
            </span>
            <span className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5"
                onClick={() => onUnpin(pinnedRuns[0].id)}
                title="Unpin"
              >
                <PinOff className="size-3 text-primary" />
              </Button>
            </span>
          </div>
          {(pinnedRuns[0].renderedPrompts || pinnedRuns[0].renderedSystemMessage) && (
            <button
              onClick={() => setShowPrompts((p) => !p)}
              className="text-xs text-foreground-muted hover:text-foreground transition-colors"
            >
              {showPrompts ? 'Hide prompts' : 'Show prompts'}
            </button>
          )}
          {showPrompts && (
            <PromptSection
              systemMessage={pinnedRuns[0].renderedSystemMessage}
              renderedPrompts={pinnedRuns[0].renderedPrompts}
            />
          )}
          {prompts.map((_p, i) => {
            const response = pinnedRuns[0].responses.find(
              (r: TestRunPromptResponse) => r.promptIndex === i
            );
            return (
              <div key={i} className="rounded-lg border border-border-subtle bg-surface p-4">
                {prompts.length > 1 && (
                  <div className="text-xs text-foreground-muted mb-2">Prompt {i + 1}</div>
                )}
                {response ? (
                  <LLMResponseBlock output={response.content} isStreaming={false} />
                ) : (
                  <span className="text-xs text-foreground-muted">—</span>
                )}
              </div>
            );
          })}
          {pinnedRuns[0].judgeScores && <JudgeScorePanel scores={pinnedRuns[0].judgeScores} />}
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
          <span>
            {isRateLimitError(error) && rateLimitCountdown > 0
              ? `Rate limit reached — you can try again in ${rateLimitCountdown}s`
              : mapPlaygroundError(error)}
          </span>
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
                    <div className="bg-elevated/50 rounded-md p-3 text-xs font-mono mb-3 border border-border-subtle whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {renderTemplate(prompt.content, fieldValues)}
                    </div>
                  )}

                  {/* Reasoning output */}
                  {streamedReasoning[i] && (
                    <ReasoningBlock
                      reasoning={streamedReasoning[i]}
                      defaultOpen={isStreaming}
                      isStreaming={isActive}
                    />
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
                  <ReasoningBlock
                    reasoning={streamedReasoning[i]}
                    defaultOpen={isStreaming}
                    isStreaming={isStreaming}
                  />
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

      {/* Judging indicator */}
      {isJudging && !judgeScores && (
        <div className="flex items-center gap-2 text-xs text-foreground-muted mt-4 pt-3 border-t border-border-subtle">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          <span>Evaluating output quality...</span>
        </div>
      )}

      {/* Judge output quality (non-comparison mode) */}
      {!hasPins && !isStreaming && hasResponses && judgeScores && (
        <JudgeScorePanel scores={judgeScores} />
      )}

      {/* Token count + elapsed time */}
      {!isStreaming && hasResponses && (
        <div className="flex items-center gap-4 text-xs text-foreground-muted mt-4">
          {elapsedSeconds > 0 && <span>{elapsedSeconds}s</span>}
          {lastTokens && (
            <>
              {lastTokens.input != null && (
                <span>{lastTokens.input.toLocaleString()} input tokens</span>
              )}
              {lastTokens.output != null && (
                <span>{lastTokens.output.toLocaleString()} output tokens</span>
              )}
            </>
          )}
        </div>
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
    </div>
  );
}
