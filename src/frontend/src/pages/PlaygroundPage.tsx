import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import PlaygroundHistorySidebar from '@/components/playground/PlaygroundHistorySidebar';
import PlaygroundResultsArea from '@/components/playground/PlaygroundResultsArea';
import PlaygroundToolbar from '@/components/playground/PlaygroundToolbar';
import { safeSessionGet } from '@/components/playground/utils';
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

  const handleRerun = useCallback(
    (run: TestRunResponse) => {
      const matchingModel = enrichedModels.find((m) => m.modelId === run.model);
      if (matchingModel) setSelectedModel(matchingModel);
      setTemperature(run.temperature);
      setMaxTokens(run.maxTokens);
      if (run.templateFieldValues) {
        setFieldValues(run.templateFieldValues);
      }
      setPendingRerun(true);
    },
    [enrichedModels]
  );

  const model = selectedModel?.modelId ?? '';
  const hasValidationErrors =
    templateFields.length > 0 && templateFields.some((f) => !fieldValues[f.name]);

  // ── Auto-execute rerun ──
  useEffect(() => {
    if (pendingRerun) {
      setPendingRerun(false);
      void handleRun();
    }
  }, [pendingRerun, handleRun]);

  // ── Keyboard shortcuts ──
  usePlaygroundKeyboardShortcuts({
    isStreaming,
    canRun: !!model && !hasValidationErrors,
    onRun: handleRun,
    onAbort: handleAbort,
  });

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
          pinnedRun={pinnedRun}
          setPinnedRun={setPinnedRun}
          expandedStepInputs={expandedStepInputs}
          setExpandedStepInputs={setExpandedStepInputs}
          copiedIndex={copiedIndex}
          handleRun={handleRun}
          handleCopy={handleCopy}
          pinnedJudgeScores={pinnedRun?.judgeScores ?? null}
          currentJudgeScores={lastJudgeScores}
          isJudging={isJudging}
        />

        {/* ── History sidebar ── */}
        {showHistory && (
          <PlaygroundHistorySidebar
            testRuns={testRuns}
            isStreaming={isStreaming}
            selectedModel={selectedModel}
            elapsedSeconds={elapsedSeconds}
            expandedRunId={expandedRunId}
            setExpandedRunId={setExpandedRunId}
            pinnedRun={pinnedRun}
            setPinnedRun={setPinnedRun}
            copiedIndex={copiedIndex}
            handleRerun={handleRerun}
            handleCopy={handleCopy}
          />
        )}
      </div>
    </div>
  );
};

export default PlaygroundPage;
