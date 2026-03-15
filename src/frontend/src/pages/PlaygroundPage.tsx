import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Play,
  Square,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  History,
  Pin,
  PinOff,
} from 'lucide-react';
import { toast } from 'sonner';

import LLMResponseBlock from '@/components/editor/LLMResponseBlock';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { parseTemplateTags } from '@/lib/templateParser';
import { mapPlaygroundError, isRateLimitError } from '@/lib/playgroundErrors';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { entryService } from '@/services';
import {
  testEntry,
  getTestRuns,
  getEnrichedModels,
  type TestStreamChunk,
  type TestRunResponse,
  type TestRunPromptResponse,
  type EnrichedModel,
} from '@/services/api/playgroundService';

import type { TemplateField } from '@/types';

function safeSessionGet<T>(key: string, fallback: T): T {
  try {
    const val = sessionStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

// ── Extracted components ──

function ReasoningBlock({ reasoning, defaultOpen }: { reasoning: string; defaultOpen: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 mb-1">
        <ChevronDown className="size-3" />
        Thinking
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 p-3 mb-3 text-xs font-mono whitespace-pre-wrap text-indigo-800 dark:text-indigo-300 max-h-40 overflow-y-auto">
          {reasoning}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CopyButton({
  text,
  index,
  copiedIndex,
  onCopy,
}: {
  text: string;
  index: number;
  copiedIndex: number | null;
  onCopy: (text: string, index: number) => Promise<void>;
}) {
  return (
    <button
      onClick={() => onCopy(text, index)}
      className="absolute top-2 right-2 p-2 rounded-md bg-surface/80 border border-border-subtle opacity-40 hover:opacity-100 focus:opacity-100 transition-opacity"
      title="Copy response"
    >
      {copiedIndex === index ? (
        <Check className="size-3.5 text-success-text" />
      ) : (
        <Copy className="size-3.5 text-foreground-muted" />
      )}
    </button>
  );
}

// ── Page ──

const PlaygroundPage = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const aiEnabled = useAiEnabled();
  const storageKey = `playground_${entryId}`;

  useEffect(() => {
    document.title = 'Clarive — Test Prompt';
  }, []);

  useEffect(() => {
    if (!aiEnabled) {
      toast.error('AI features are not configured.');
      navigate(entryId ? `/entry/${entryId}` : '/', { replace: true });
    }
  }, [aiEnabled, navigate, entryId]);

  // ── Data fetching ──
  const {
    data: entry,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => entryService.getEntry(entryId!),
    enabled: !!entryId && aiEnabled,
  });

  const prompts = entry?.prompts ?? [];
  const isChain = prompts.length > 1;

  // ── Model & params ──
  const [selectedModel, setSelectedModel] = useState<EnrichedModel | null>(null);
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [reasoningEffort, setReasoningEffort] = useState('medium');
  const [showReasoning, setShowReasoning] = useState(true);

  // ── Template fields ──
  const templateFields = useMemo(() => {
    const seen = new Set<string>();
    const fields: TemplateField[] = [];
    for (const p of prompts) {
      for (const f of parseTemplateTags(p.content)) {
        if (!seen.has(f.name)) {
          seen.add(f.name);
          fields.push(f);
        }
      }
    }
    return fields;
  }, [prompts]);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    safeSessionGet(storageKey + '_fields', {})
  );

  useEffect(() => {
    if (Object.keys(fieldValues).length > 0) {
      sessionStorage.setItem(storageKey + '_fields', JSON.stringify(fieldValues));
    }
  }, [fieldValues, storageKey]);

  // ── Streaming state ──
  const [isStreaming, setIsStreaming] = useState(false);
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const firstTokenRef = useRef(false);
  const [streamedResponses, setStreamedResponses] = useState<Record<number, string>>({});
  const [streamedReasoning, setStreamedReasoning] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Elapsed time + tokens ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastTokens, setLastTokens] = useState<{ input: number | null; output: number | null } | null>(null);

  // ── Response display ──
  const responseAreaRef = useRef<HTMLDivElement>(null);
  const [expandedStepInputs, setExpandedStepInputs] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // ── Rerun ──
  const [pendingRerun, setPendingRerun] = useState(false);

  // ── History + comparison ──
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [pinnedRun, setPinnedRun] = useState<TestRunResponse | null>(null);

  // ── Queries ──
  const { data: enrichedModels = [], isError: modelsError } = useQuery({
    queryKey: ['playground', 'enriched-models'],
    queryFn: getEnrichedModels,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: testRuns = [] } = useQuery({
    queryKey: ['playground', 'runs', entryId],
    queryFn: () => getTestRuns(entryId!),
    staleTime: 30 * 1000,
    enabled: !!entryId,
  });

  useEffect(() => {
    if (enrichedModels.length > 0 && !selectedModel) {
      setSelectedModel(enrichedModels[0]);
    }
  }, [enrichedModels, selectedModel]);

  // ── Auto-scroll to response on first token ──
  useEffect(() => {
    if (firstTokenReceived) {
      responseAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [firstTokenReceived]);

  // ── Handlers ──
  const handleRun = useCallback(async () => {
    if (!entryId) return;
    setIsStreaming(true);
    setFirstTokenReceived(false);
    firstTokenRef.current = false;
    setStreamedResponses({});
    setStreamedReasoning({});
    setError(null);
    setRateLimitCountdown(0);
    if (rateLimitTimerRef.current) {
      clearInterval(rateLimitTimerRef.current);
      rateLimitTimerRef.current = null;
    }
    setLastTokens(null);
    setElapsedSeconds(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await testEntry(
        entryId,
        {
          model: selectedModel?.modelId || undefined,
          temperature,
          maxTokens,
          templateFields: templateFields.length > 0 ? fieldValues : undefined,
          reasoningEffort: selectedModel?.isReasoning && showReasoning ? reasoningEffort : undefined,
          showReasoning: selectedModel?.isReasoning ? showReasoning : undefined,
        },
        (chunk: TestStreamChunk) => {
          if (!chunk.text) return; // Skip empty chunks from Responses API
          if (!firstTokenRef.current) {
            firstTokenRef.current = true;
            setFirstTokenReceived(true);
          }
          if (chunk.type === 'reasoning') {
            setStreamedReasoning((prev) => ({
              ...prev,
              [chunk.promptIndex]: (prev[chunk.promptIndex] || '') + chunk.text,
            }));
          } else {
            setStreamedResponses((prev) => ({
              ...prev,
              [chunk.promptIndex]: (prev[chunk.promptIndex] || '') + chunk.text,
            }));
          }
        },
        controller.signal
      );

      if (result.inputTokens != null || result.outputTokens != null) {
        setLastTokens({ input: result.inputTokens, output: result.outputTokens });
      }

      queryClient.invalidateQueries({ queryKey: ['playground', 'runs', entryId] });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.info('Generation stopped');
      } else {
        const rawMessage = err instanceof Error ? err.message : 'Test failed';
        setError(rawMessage);
        if (isRateLimitError(rawMessage)) {
          setRateLimitCountdown(60);
          if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
          rateLimitTimerRef.current = setInterval(() => {
            setRateLimitCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(rateLimitTimerRef.current!);
                rateLimitTimerRef.current = null;
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }
  }, [entryId, selectedModel, temperature, maxTokens, fieldValues, templateFields, queryClient, showReasoning, reasoningEffort]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleCopy = useCallback(async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const handleRerun = useCallback((run: TestRunResponse) => {
    const matchingModel = enrichedModels.find((m) => m.modelId === run.model);
    if (matchingModel) setSelectedModel(matchingModel);
    setTemperature(run.temperature);
    setMaxTokens(run.maxTokens);
    if (run.templateFieldValues) {
      setFieldValues(run.templateFieldValues);
    }
    setPendingRerun(true);
  }, [enrichedModels]);

  const hasResponses = Object.keys(streamedResponses).length > 0;
  const model = selectedModel?.modelId ?? '';
  const hasValidationErrors = templateFields.length > 0 && templateFields.some((f) => !fieldValues[f.name]);

  // ── Auto-execute rerun ──
  useEffect(() => {
    if (pendingRerun) {
      setPendingRerun(false);
      handleRun();
    }
  }, [pendingRerun, handleRun]);

  // ── Keyboard shortcut: Cmd/Ctrl+Enter to run ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (!isStreaming && model && !hasValidationErrors) {
          e.preventDefault();
          handleRun();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isStreaming, model, hasValidationErrors, handleRun]);

  const modelsByProvider = useMemo(
    () =>
      enrichedModels.reduce<Record<string, EnrichedModel[]>>((acc, m) => {
        (acc[m.providerName] ??= []).push(m);
        return acc;
      }, {}),
    [enrichedModels]
  );

  if (!aiEnabled) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !entry) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-foreground-muted">Entry not found.</p>
        <Button variant="outline" asChild>
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="border-b border-border-subtle bg-surface px-6 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Back + title */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/entry/${entryId}`)}
            className="gap-1.5 shrink-0"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium truncate max-w-xs">{entry.title}</span>
          {isChain && (
            <span className="text-xs text-foreground-muted">
              {prompts.length} prompts
            </span>
          )}

          <div className="flex-1" />

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Model */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-foreground-muted shrink-0">Model</Label>
              {modelsError ? (
                <span className="text-xs text-destructive">Failed to load models</span>
              ) : (
                <Select
                  value={model}
                  onValueChange={(v) => {
                    const found = enrichedModels.find((m) => m.modelId === v);
                    if (found) setSelectedModel(found);
                  }}
                >
                  <SelectTrigger className="w-52 h-8 text-xs">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(modelsByProvider).map(([provider, models]) => (
                      <SelectGroup key={provider}>
                        <SelectLabel className="text-xs font-semibold text-foreground-muted px-2">
                          {provider}
                        </SelectLabel>
                        {models.map((m) => (
                          <SelectItem key={m.modelId} value={m.modelId} className="text-xs">
                            {m.displayName || m.modelId}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Temperature (hidden for non-configurable models) */}
            {selectedModel?.isTemperatureConfigurable !== false && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-foreground-muted shrink-0">Temp</Label>
                <Slider
                  value={[temperature]}
                  onValueChange={([v]) => setTemperature(v)}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-20"
                />
                <span className="text-xs text-foreground-muted w-7 tabular-nums">
                  {temperature.toFixed(1)}
                </span>
              </div>
            )}

            {/* Reasoning controls (shown for reasoning models) */}
            {selectedModel?.isReasoning && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-foreground-muted shrink-0">Reasoning</Label>
                  <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low" className="text-xs">Low</SelectItem>
                      <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                      <SelectItem value="high" className="text-xs">High</SelectItem>
                      <SelectItem value="extra-high" className="text-xs">Extra High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-foreground-muted">Show thinking</Label>
                  <input
                    type="checkbox"
                    checked={showReasoning}
                    onChange={(e) => setShowReasoning(e.target.checked)}
                    className="size-3.5 rounded"
                  />
                </div>
              </>
            )}

            {/* Max tokens */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-foreground-muted shrink-0">Tokens</Label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value) || 4096)}
                className="w-20 h-8 text-xs"
                min={1}
                max={32000}
              />
            </div>

            {/* History toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((p) => !p)}
              className={showHistory ? 'bg-elevated' : ''}
            >
              <History className="size-4" />
            </Button>

            {/* Run / Stop */}
            {isStreaming ? (
              <Button size="sm" variant="destructive" onClick={handleAbort}>
                <Square className="size-3 mr-1.5" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleRun}
                disabled={!model || hasValidationErrors}
                title="Run (⌘+Enter)"
              >
                <Play className="size-3 mr-1.5" />
                Run
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Response area */}
        <ScrollArea className="flex-1 p-6">
          {/* Template variables (collapsible) */}
          {templateFields.length > 0 && (
            <Collapsible defaultOpen className="mb-6">
              <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-foreground-muted mb-2">
                <ChevronDown className="size-3.5" />
                Template Variables ({templateFields.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                            <SelectTrigger className={`h-8 text-xs ${isEmpty ? 'border-destructive' : ''}`}>
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

          {/* Comparison layout */}
          {pinnedRun && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-foreground-muted">
                  <Pin className="size-3.5 text-primary" />
                  <span className="font-medium">Pinned: {pinnedRun.model}</span>
                  <span>t={pinnedRun.temperature.toFixed(1)}</span>
                  <span>{new Date(pinnedRun.createdAt).toLocaleString()}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setPinnedRun(null)}
                >
                  <PinOff className="size-3 mr-1" />
                  Unpin
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Pinned run responses */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-foreground-muted mb-2">Pinned Run</div>
                  {pinnedRun.responses.map((r: TestRunPromptResponse) => (
                    <div key={r.promptIndex} className="rounded-lg border border-border-subtle bg-surface p-4">
                      {prompts.length > 1 && (
                        <div className="text-xs text-foreground-muted mb-2">Prompt {r.promptIndex + 1}</div>
                      )}
                      <LLMResponseBlock output={r.content} isStreaming={false} />
                    </div>
                  ))}
                </div>
                {/* Current run responses */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-foreground-muted mb-2">
                    {isStreaming ? 'Current Run (streaming...)' : hasResponses ? 'Current Run' : 'Run a new test to compare'}
                  </div>
                  {prompts.map((_p, i) => {
                    const response = streamedResponses[i];
                    if (response === undefined) return null;
                    return (
                      <div key={i} className="rounded-lg border border-border-subtle bg-surface p-4">
                        {prompts.length > 1 && (
                          <div className="text-xs text-foreground-muted mb-2">Prompt {i + 1}</div>
                        )}
                        <LLMResponseBlock output={response} isStreaming={isStreaming} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Streaming indicator (non-comparison mode) */}
          {!pinnedRun && isStreaming && (
            <div ref={responseAreaRef} className="flex items-center gap-2 text-sm text-foreground-muted mb-4">
              {firstTokenReceived ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Generating... {elapsedSeconds > 0 && `${elapsedSeconds}s`}</span>
                </>
              ) : (
                <span className="flex items-center gap-1">
                  Connecting
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
          {!pinnedRun && isChain && (hasResponses || isStreaming) && (
            <div className="space-y-0">
              {prompts.map((prompt, i) => {
                const response = streamedResponses[i];
                const isActive = isStreaming && response !== undefined && i === Math.max(...Object.keys(streamedResponses).map(Number));
                const isComplete = !isStreaming && response !== undefined;
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
                              next.has(i) ? next.delete(i) : next.add(i);
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
                          {prompt.content}
                        </div>
                      )}

                      {/* Reasoning output */}
                      {streamedReasoning[i] && (
                        <ReasoningBlock reasoning={streamedReasoning[i]} defaultOpen={isStreaming} />
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
                            <CopyButton text={response} index={i} copiedIndex={copiedIndex} onCopy={handleCopy} />
                          )}
                        </div>
                      ) : isStreaming && i === Object.keys(streamedResponses).length ? (
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
          {!pinnedRun && !isStreaming && isChain && Object.keys(streamedResponses).length >= 2 && (
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
          {!pinnedRun && !isChain && (hasResponses || isStreaming) && (
            <div className="space-y-3">
              {prompts.map((_prompt, i) => {
                const response = streamedResponses[i];
                if (response === undefined && !isStreaming) return null;

                return (
                  <div key={i}>
                    {streamedReasoning[i] && (
                      <ReasoningBlock reasoning={streamedReasoning[i]} defaultOpen={isStreaming} />
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
                        <CopyButton text={response} index={i} copiedIndex={copiedIndex} onCopy={handleCopy} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Token count + elapsed time */}
          {!isStreaming && hasResponses && (
            <div className="flex items-center gap-4 text-xs text-foreground-muted mt-4">
              {elapsedSeconds > 0 && <span>{elapsedSeconds}s</span>}
              {lastTokens && (
                <>
                  {lastTokens.input != null && <span>{lastTokens.input.toLocaleString()} input tokens</span>}
                  {lastTokens.output != null && <span>{lastTokens.output.toLocaleString()} output tokens</span>}
                </>
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasResponses && !isStreaming && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-foreground-muted">
              <Play className="size-10 mb-4 opacity-20" />
              <p className="text-sm">Click Run to test your prompt</p>
              {isChain && (
                <p className="text-xs mt-1">
                  {prompts.length} prompts will execute sequentially
                </p>
              )}
            </div>
          )}
        </ScrollArea>

        {/* ── History sidebar ── */}
        {showHistory && (
          <div className="w-80 border-l border-border-subtle bg-surface overflow-hidden flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
              <Clock className="size-4 text-foreground-muted" />
              <span className="text-sm font-medium">History</span>
              <span className="text-xs text-foreground-muted">({testRuns.length})</span>
            </div>
            <ScrollArea className="flex-1">
              {testRuns.length === 0 ? (
                <p className="text-xs text-foreground-muted p-4 text-center">
                  No test runs yet
                </p>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {testRuns.map((run) => (
                    <div key={run.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <button
                          onClick={() =>
                            setExpandedRunId(expandedRunId === run.id ? null : run.id)
                          }
                          className="flex items-center gap-1.5 text-xs text-foreground-secondary hover:text-foreground transition-colors"
                        >
                          {expandedRunId === run.id ? (
                            <ChevronDown className="size-3" />
                          ) : (
                            <ChevronRight className="size-3" />
                          )}
                          <span className="font-mono">{run.model}</span>
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5"
                          onClick={() => setPinnedRun(pinnedRun?.id === run.id ? null : run)}
                          title={pinnedRun?.id === run.id ? 'Unpin' : 'Pin for comparison'}
                        >
                          {pinnedRun?.id === run.id ? (
                            <PinOff className="size-3 text-primary" />
                          ) : (
                            <Pin className="size-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5"
                          onClick={() => handleRerun(run)}
                          title="Load parameters"
                        >
                          <RotateCcw className="size-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-foreground-muted flex items-center gap-2">
                        <span>t={run.temperature.toFixed(1)}</span>
                        <span>max={run.maxTokens}</span>
                      </div>
                      <div className="text-xs text-foreground-muted mt-0.5">
                        {new Date(run.createdAt).toLocaleString()}
                      </div>

                      {expandedRunId === run.id && (
                        <div className="mt-2 space-y-2">
                          {run.responses.map((r: TestRunPromptResponse) => (
                            <div key={r.promptIndex} className="relative group">
                              <div className="bg-elevated rounded-md p-2 border border-border-subtle max-h-40 overflow-y-auto text-xs">
                                <LLMResponseBlock output={r.content} isStreaming={false} />
                              </div>
                              <button
                                onClick={() => handleCopy(r.content, 1000 + r.promptIndex)}
                                className="absolute top-1 right-1 p-1 rounded bg-elevated/80 border border-border-subtle opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {copiedIndex === 1000 + r.promptIndex ? (
                                  <Check className="size-3 text-success-text" />
                                ) : (
                                  <Copy className="size-3 text-foreground-muted" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaygroundPage;
