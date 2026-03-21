import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useBlocker, Link } from 'react-router-dom';
import { toast } from 'sonner';

import PlaygroundHistorySidebar from '@/components/playground/PlaygroundHistorySidebar';
import PlaygroundResultsArea from '@/components/playground/PlaygroundResultsArea';
import PlaygroundToolbar from '@/components/playground/PlaygroundToolbar';
import QueueStrip from '@/components/playground/QueueStrip';
import { type QueuedModel } from '@/components/playground/utils';
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
import { usePlaygroundBatchOrchestration } from '@/hooks/usePlaygroundBatchOrchestration';
import { usePlaygroundComparison } from '@/hooks/usePlaygroundComparison';
import { usePlaygroundKeyboardShortcuts } from '@/hooks/usePlaygroundKeyboardShortcuts';
import { usePlaygroundModelSelection } from '@/hooks/usePlaygroundModelSelection';
import { usePlaygroundQueueManager } from '@/hooks/usePlaygroundQueueManager';
import { usePlaygroundStreaming } from '@/hooks/usePlaygroundStreaming';
import { usePlaygroundTemplateFields } from '@/hooks/usePlaygroundTemplateFields';
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

  // ── Models query (needed by model selection hook) ──
  const { data: enrichedModels = [], isError: modelsError } = useQuery({
    queryKey: ['playground', 'enriched-models'],
    queryFn: getEnrichedModels,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── Model & params (extracted hook) ──
  const {
    selectedModel,
    setSelectedModel,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    reasoningEffort,
    setReasoningEffort,
    showReasoning,
    setShowReasoning,
    applyModelParameters,
    handleModelChange,
  } = usePlaygroundModelSelection(enrichedModels);

  // ── Template fields (extracted hook) ──
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

  const { fieldValues, setFieldValues } = usePlaygroundTemplateFields(templateFields, storageKey);

  // ── MCP tool state ──
  const [enabledServerIds, setEnabledServerIds] = useState<string[]>([]);
  const [excludedToolNames, setExcludedToolNames] = useState<string[]>([]);

  // ── Streaming (delegated to hook) ──
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
    lastRunId,
    lastJudgeScores,
    lastVersionLabel,
    isJudging,
    hasResponses,
    responseCount,
    handleRun,
    handleAbort,
    clearCurrentRun,
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
    mcpServerIds: enabledServerIds.length > 0 ? enabledServerIds : undefined,
    excludedToolNames: excludedToolNames.length > 0 ? excludedToolNames : undefined,
  });

  // ── Response display ──
  const [expandedStepInputs, setExpandedStepInputs] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // ── History + comparison (extracted hook) ──
  const {
    showHistory,
    setShowHistory,
    expandedRunId,
    setExpandedRunId,
    pinnedRuns,
    activeCarouselIndex,
    setActiveCarouselIndex,
    addPin,
    removePin,
    togglePin,
    clearAllPins,
  } = usePlaygroundComparison();
  const [isFillingTemplateFields, setIsFillingTemplateFields] = useState(false);

  // ── Queue manager (extracted hook) ──
  const {
    queuedModels,
    setQueuedModels,
    handleEnqueue,
    handleRemoveFromQueue,
    handleClearQueue,
  } = usePlaygroundQueueManager({
    selectedModel,
    temperature,
    maxTokens,
    reasoningEffort,
    showReasoning,
  });

  // ── Batch orchestration (extracted hook) ──
  const {
    executionQueue,
    batchTotal,
    batchCurrent,
    isBatchRunning,
    handleRunQueue: batchRunQueue,
    handleBatchAbort,
  } = usePlaygroundBatchOrchestration({
    entryId,
    isStreaming,
    lastRunId,
    error,
    wasStopped,
    rateLimitCountdown,
    selectedModel,
    handleRun,
    handleAbort,
    addPin,
    clearAllPins,
    applyModelParameters,
  });

  const handleRunQueue = useCallback(() => {
    batchRunQueue(queuedModels);
    setQueuedModels([]);
  }, [batchRunQueue, queuedModels, setQueuedModels]);

  // ── Queries ──
  const { data: testRuns = [] } = useQuery({
    queryKey: ['playground', 'runs', entryId],
    queryFn: () => getTestRuns(entryId!),
    staleTime: 30 * 1000,
    enabled: !!entryId,
  });

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
  }, [entryId, setFieldValues]);

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
    [enrichedModels, setFieldValues]
  );

  const model = selectedModel?.modelId ?? '';
  const hasValidationErrors =
    templateFields.length > 0 && templateFields.some((f) => !fieldValues[f.name]);

  // ── Keyboard shortcuts ──
  usePlaygroundKeyboardShortcuts({
    isStreaming,
    canRun: !!model && !hasValidationErrors && queuedModels.length === 0,
    onRun: handleRun,
    onAbort: isBatchRunning ? handleBatchAbort : handleAbort,
  });

  // ── Navigation guard while streaming or batch running ──
  const blocker = useBlocker(isStreaming || executionQueue.length > 0);

  useEffect(() => {
    if (!isStreaming && executionQueue.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isStreaming, executionQueue.length]);

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
    <div className="flex flex-col h-full overflow-hidden">
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
        handleAbort={isBatchRunning ? handleBatchAbort : handleAbort}
        onModelChange={handleModelChange}
        onEnqueue={handleEnqueue}
        queueLength={queuedModels.length}
        isBatchRunning={isBatchRunning}
        batchCurrent={batchCurrent}
        batchTotal={batchTotal}
        enabledServerIds={enabledServerIds}
        setEnabledServerIds={setEnabledServerIds}
        excludedToolNames={excludedToolNames}
        setExcludedToolNames={setExcludedToolNames}
      />

      {/* ── Queue strip ── */}
      {(queuedModels.length > 0 || isBatchRunning) && (
        <QueueStrip
          queue={queuedModels}
          onRemove={handleRemoveFromQueue}
          onClear={handleClearQueue}
          onRunQueue={handleRunQueue}
          isStreaming={isStreaming}
          isBatchRunning={isBatchRunning}
          batchCurrent={batchCurrent}
          batchTotal={batchTotal}
        />
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0">
        {/* Response area */}
        <PlaygroundResultsArea
          prompts={prompts}
          isChain={isChain}
          isStreaming={isStreaming}
          firstTokenReceived={firstTokenReceived}
          segments={segments}
          error={error}
          wasStopped={wasStopped}
          rateLimitCountdown={rateLimitCountdown}
          elapsedSeconds={elapsedSeconds}
          approxOutputTokens={approxOutputTokens}
          lastTokens={lastTokens}
          hasResponses={hasResponses}
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
          onClearCurrentRun={clearCurrentRun}
        />

        {/* ── History sidebar — overlay on small screens, inline on md+ ── */}
        {showHistory && (
          <>
            {/* Backdrop for small screens */}
            <div
              className="fixed inset-0 z-30 bg-black/30 md:hidden"
              onClick={() => setShowHistory(false)}
            />
            <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-80 md:relative md:inset-auto md:z-auto md:h-full md:shrink-0">
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

      {/* Navigation guard during streaming or batch */}
      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Test in progress</AlertDialogTitle>
            <AlertDialogDescription>
              {isBatchRunning
                ? `A batch comparison is running (${batchCurrent} of ${batchTotal} models completed). Leaving will stop the current run and cancel remaining models.`
                : 'A test is currently running. Leaving will stop the generation and discard the response.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (isBatchRunning) {
                  handleBatchAbort();
                } else {
                  handleAbort();
                }
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
