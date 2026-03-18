import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useBlocker, Link } from 'react-router-dom';
import { toast } from 'sonner';

import PlaygroundHistorySidebar from '@/components/playground/PlaygroundHistorySidebar';
import PlaygroundResultsArea from '@/components/playground/PlaygroundResultsArea';
import PlaygroundToolbar from '@/components/playground/PlaygroundToolbar';
import { safeSessionGet, addPinToList, removePinFromList } from '@/components/playground/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { usePlaygroundKeyboardShortcuts } from '@/hooks/usePlaygroundKeyboardShortcuts';
import { usePlaygroundStreaming } from '@/hooks/usePlaygroundStreaming';
import { PLAYGROUND_DEFAULTS } from '@/lib/constants';
import { parseTemplateTags } from '@/lib/templateParser';
import { entryService } from '@/services';
import {
  getTestRuns,
  getEnrichedModels,
  fillTemplateFields,
  type TestRunResponse,
  type EnrichedModel,
} from '@/services/api/playgroundService';
import type { TemplateField } from '@/types';

// ── Page ──
// Animation tier: None — streaming provides real-time feedback

const PlaygroundPage = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
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

  const prompts = useMemo(() => entry?.prompts ?? [], [entry]);
  const isChain = prompts.length > 1;

  // ── Model & params ──
  const [selectedModel, setSelectedModel] = useState<EnrichedModel | null>(null);
  const [temperature, setTemperature] = useState(PLAYGROUND_DEFAULTS.TEMPERATURE);
  const [maxTokens, setMaxTokens] = useState(PLAYGROUND_DEFAULTS.MAX_TOKENS);
  const [reasoningEffort, setReasoningEffort] = useState(PLAYGROUND_DEFAULTS.REASONING_EFFORT);
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

  // Pre-fill defaults for fields without stored values
  useEffect(() => {
    if (templateFields.length === 0) return;
    const updates: Record<string, string> = {};
    for (const field of templateFields) {
      if (!fieldValues[field.name]) {
        if (field.defaultValue) {
          updates[field.name] = field.defaultValue;
        } else if (field.min !== null) {
          updates[field.name] = String(field.min);
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      setFieldValues((prev) => ({ ...prev, ...updates }));
    }
  }, [templateFields]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Streaming (delegated to hook) ──
  const {
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
    lastJudgeScores,
    lastVersionLabel,
    isJudging,
    hasResponses,
    currentPromptIndex,
    responseCount,
    handleRun,
    handleAbort,
    responseAreaRef,
  } = usePlaygroundStreaming({
    entryId,
    model: selectedModel?.modelId ?? '',
    temperature,
    maxTokens,
    templateFields,
    fieldValues,
    reasoningEffort,
    showReasoning,
    isReasoning: selectedModel?.isReasoning ?? false,
  });

  // ── Response display ──
  const [expandedStepInputs, setExpandedStepInputs] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // ── History + comparison ──
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [pinnedRuns, setPinnedRuns] = useState<TestRunResponse[]>([]);

  const addPin = useCallback((run: TestRunResponse) => {
    setPinnedRuns((prev) => addPinToList(prev, run));
  }, []);

  const removePin = useCallback((runId: string) => {
    setPinnedRuns((prev) => removePinFromList(prev, runId));
  }, []);

  const togglePin = useCallback((run: TestRunResponse) => {
    setPinnedRuns((prev) =>
      prev.some((r) => r.id === run.id) ? removePinFromList(prev, run.id) : addPinToList(prev, run)
    );
  }, []);
  const clearAllPins = useCallback(() => setPinnedRuns([]), []);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [isFillingTemplateFields, setIsFillingTemplateFields] = useState(false);

  // Reset carousel index when pins change + notify when all cleared
  const prevPinCountRef = useRef(0);
  useEffect(() => {
    setActiveCarouselIndex(0);
    if (prevPinCountRef.current > 0 && pinnedRuns.length === 0) {
      toast.info('Comparison cleared');
    }
    prevPinCountRef.current = pinnedRuns.length;
  }, [pinnedRuns.length]);

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
      const first = enrichedModels[0];
      setSelectedModel(first);
      setTemperature(first.defaultTemperature ?? PLAYGROUND_DEFAULTS.TEMPERATURE);
      setMaxTokens(first.defaultMaxTokens ?? PLAYGROUND_DEFAULTS.MAX_TOKENS);
      setReasoningEffort(first.defaultReasoningEffort ?? PLAYGROUND_DEFAULTS.REASONING_EFFORT);
    }
  }, [enrichedModels, selectedModel]);

  // ── Handlers ──
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

  const handleFillTemplateFields = useCallback(async () => {
    if (!entryId) return;
    setIsFillingTemplateFields(true);
    try {
      const values = await fillTemplateFields(entryId);
      setFieldValues(values);
    } catch {
      toast.error('Failed to generate example values');
    } finally {
      setIsFillingTemplateFields(false);
    }
  }, [entryId]);

  const handleRerun = useCallback(
    (run: TestRunResponse) => {
      const matchingModel = enrichedModels.find((m) => m.modelId === run.model);
      if (matchingModel) setSelectedModel(matchingModel);
      setTemperature(run.temperature);
      setMaxTokens(run.maxTokens);
      if (run.templateFieldValues) {
        setFieldValues(run.templateFieldValues);
      }
      toast.success('Parameters loaded from history');
    },
    [enrichedModels]
  );

  const model = selectedModel?.modelId ?? '';
  const hasValidationErrors =
    templateFields.length > 0 && templateFields.some((f) => !fieldValues[f.name]);

  // ── Keyboard shortcuts ──
  usePlaygroundKeyboardShortcuts({
    isStreaming,
    canRun: !!model && !hasValidationErrors,
    onRun: handleRun,
    onAbort: handleAbort,
  });

  // ── Navigation guard while streaming ──
  const blocker = useBlocker(isStreaming);

  useEffect(() => {
    if (!isStreaming) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isStreaming]);

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
      <div className="flex flex-col h-full">
        {/* Toolbar skeleton */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 h-14">
          <Skeleton className="size-8 rounded" />
          <Skeleton className="h-5 w-40 rounded" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-3/4 rounded-lg" />
          <Skeleton className="mt-6 h-[300px] w-full rounded-xl" />
        </div>
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
      <PlaygroundToolbar
        entryId={entryId}
        entryTitle={entry.title}
        isChain={isChain}
        promptsCount={prompts.length}
        selectedModel={selectedModel}
        model={model}
        modelsByProvider={modelsByProvider}
        modelsError={modelsError}
        enrichedModels={enrichedModels}
        temperature={temperature}
        setTemperature={setTemperature}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
        reasoningEffort={reasoningEffort}
        setReasoningEffort={setReasoningEffort}
        showReasoning={showReasoning}
        setShowReasoning={setShowReasoning}
        isStreaming={isStreaming}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        hasValidationErrors={hasValidationErrors}
        handleRun={handleRun}
        handleAbort={handleAbort}
        onModelChange={(found) => {
          setSelectedModel(found);
          setTemperature(found.defaultTemperature ?? PLAYGROUND_DEFAULTS.TEMPERATURE);
          setMaxTokens(found.defaultMaxTokens ?? PLAYGROUND_DEFAULTS.MAX_TOKENS);
          setReasoningEffort(found.defaultReasoningEffort ?? PLAYGROUND_DEFAULTS.REASONING_EFFORT);
        }}
      />

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Response area */}
        <PlaygroundResultsArea
          prompts={prompts}
          isChain={isChain}
          isStreaming={isStreaming}
          firstTokenReceived={firstTokenReceived}
          streamedResponses={streamedResponses}
          streamedReasoning={streamedReasoning}
          error={error}
          wasStopped={wasStopped}
          rateLimitCountdown={rateLimitCountdown}
          elapsedSeconds={elapsedSeconds}
          approxOutputTokens={approxOutputTokens}
          lastTokens={lastTokens}
          hasResponses={hasResponses}
          currentPromptIndex={currentPromptIndex}
          responseCount={responseCount}
          responseAreaRef={responseAreaRef}
          templateFields={templateFields}
          fieldValues={fieldValues}
          setFieldValues={setFieldValues}
          pinnedRuns={pinnedRuns}
          onUnpin={removePin}
          onClearAllPins={clearAllPins}
          activeCarouselIndex={activeCarouselIndex}
          setActiveCarouselIndex={setActiveCarouselIndex}
          expandedStepInputs={expandedStepInputs}
          setExpandedStepInputs={setExpandedStepInputs}
          copiedIndex={copiedIndex}
          handleRun={handleRun}
          handleCopy={handleCopy}
          currentJudgeScores={lastJudgeScores}
          isJudging={isJudging}
          currentVersionLabel={lastVersionLabel}
          onFillTemplateFields={templateFields.length > 0 ? handleFillTemplateFields : undefined}
          isFillingTemplateFields={isFillingTemplateFields}
        />

        {/* ── History sidebar — overlay on small screens, inline on md+ ── */}
        {showHistory && (
          <>
            {/* Backdrop for small screens */}
            <div
              className="fixed inset-0 z-30 bg-black/30 md:hidden"
              onClick={() => setShowHistory(false)}
            />
            <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:relative md:inset-auto md:z-auto">
              <PlaygroundHistorySidebar
                testRuns={testRuns}
                isStreaming={isStreaming}
                selectedModel={selectedModel}
                elapsedSeconds={elapsedSeconds}
                expandedRunId={expandedRunId}
                setExpandedRunId={setExpandedRunId}
                pinnedRuns={pinnedRuns}
                onTogglePin={togglePin}
                copiedIndex={copiedIndex}
                handleRerun={handleRerun}
                handleCopy={handleCopy}
                onClose={() => setShowHistory(false)}
              />
            </div>
          </>
        )}
      </div>

      {/* Navigation guard during streaming */}
      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Test in progress</AlertDialogTitle>
            <AlertDialogDescription>
              A test is currently running. Leaving will stop the generation and discard the
              response.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleAbort();
                blocker.proceed?.();
              }}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlaygroundPage;
