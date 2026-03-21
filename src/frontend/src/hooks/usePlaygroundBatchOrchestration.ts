import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { QueuedModel } from '@/components/playground/utils';
import type { TestRunResponse, EnrichedModel } from '@/services/api/playgroundService';

interface BatchOrchestrationParams {
  entryId: string | undefined;
  isStreaming: boolean;
  lastRunId: string | null;
  error: string | null;
  wasStopped: boolean;
  rateLimitCountdown: number;
  selectedModel: EnrichedModel | null;
  handleRun: () => void;
  handleAbort: () => void;
  addPin: (run: TestRunResponse) => void;
  clearAllPins: () => void;
  applyModelParameters: (item: QueuedModel) => void;
}

/**
 * Manages batch execution state and orchestration for multi-model comparison runs.
 * Handles: execution queue consumption, auto-pinning completed runs, rate-limit
 * recovery, and auto-triggering runs when model parameters change.
 */
export function usePlaygroundBatchOrchestration({
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
}: BatchOrchestrationParams) {
  const queryClient = useQueryClient();
  const [executionQueue, setExecutionQueue] = useState<QueuedModel[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const batchAbortedRef = useRef(false);

  const isBatchRunning = executionQueue.length > 0 || (batchTotal > 0 && isStreaming);
  const batchCurrent = batchTotal - executionQueue.length;

  // ── Auto-pin completed run + start next ──
  const prevIsStreamingRef = useRef(false);
  useEffect(() => {
    const justFinished = prevIsStreamingRef.current && !isStreaming;
    prevIsStreamingRef.current = isStreaming;

    if (!justFinished || batchTotal === 0) return;

    // Auto-pin the just-completed run
    if (lastRunId && !error && !wasStopped) {
      queryClient
        .invalidateQueries({ queryKey: ['playground', 'runs', entryId] })
        .then(() => {
          const runs = queryClient.getQueryData<TestRunResponse[]>([
            'playground',
            'runs',
            entryId,
          ]);
          const completedRun = runs?.find((r) => r.id === lastRunId);
          if (completedRun) addPin(completedRun);
        })
        .catch(() => {
          toast.error('Failed to save comparison run');
        });
    }

    // Error on one model during batch: toast and continue
    if (error && executionQueue.length > 0 && !batchAbortedRef.current) {
      const failedName = selectedModel?.displayName || selectedModel?.modelId || 'Unknown model';
      toast.error(`Failed: ${failedName}`);
    }

    // If aborted or no more models, clean up batch state
    if (batchAbortedRef.current || executionQueue.length === 0) {
      setBatchTotal(0);
      batchAbortedRef.current = false;
      return;
    }

    // Rate limit: wait for countdown to expire before continuing
    if (rateLimitCountdown > 0) return;

    // Start next item in execution queue
    const nextItem = executionQueue[0];
    applyModelParameters(nextItem);
    setExecutionQueue((prev) => prev.slice(1));
  }, [
    isStreaming,
    batchTotal,
    executionQueue,
    lastRunId,
    error,
    wasStopped,
    rateLimitCountdown,
    entryId,
    queryClient,
    addPin,
    selectedModel,
    applyModelParameters,
  ]);

  // ── Rate limit recovery: resume batch when countdown reaches 0 ──
  // Intentionally limited deps — only fires when rateLimitCountdown transitions
  // to 0, reading other values from their current state at that moment.
  useEffect(() => {
    if (
      rateLimitCountdown === 0 &&
      executionQueue.length > 0 &&
      !isStreaming &&
      !batchAbortedRef.current &&
      batchTotal > 0
    ) {
      const nextItem = executionQueue[0];
      applyModelParameters(nextItem);
      setExecutionQueue((prev) => prev.slice(1));
    }
  }, [rateLimitCountdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trigger handleRun when model changes during batch execution ──
  // Intentionally limited deps — watches selectedModel changes during active
  // batch and fires handleRun via setTimeout to allow React state to settle.
  const prevModelRef = useRef<string | null>(null);
  useEffect(() => {
    const modelId = selectedModel?.modelId ?? null;
    if (modelId && modelId !== prevModelRef.current && batchTotal > 0 && !isStreaming) {
      prevModelRef.current = modelId;
      const timer = setTimeout(() => handleRun(), 50);
      return () => clearTimeout(timer);
    }
    if (!modelId) prevModelRef.current = null;
  }, [selectedModel, batchTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start batch from queued models ──
  const handleRunQueue = useCallback(
    (queuedModels: QueuedModel[]) => {
      if (queuedModels.length === 0) return;
      clearAllPins();
      batchAbortedRef.current = false;
      prevModelRef.current = null;
      setBatchTotal(queuedModels.length);
      setExecutionQueue(queuedModels.slice(1));
      applyModelParameters(queuedModels[0]);
    },
    [clearAllPins, applyModelParameters]
  );

  // ── Abort batch ──
  const handleBatchAbort = useCallback(() => {
    batchAbortedRef.current = true;
    setExecutionQueue([]);
    setBatchTotal(0);
    handleAbort();
  }, [handleAbort]);

  return {
    executionQueue,
    batchTotal,
    batchCurrent,
    isBatchRunning,
    handleRunQueue,
    handleBatchAbort,
  };
}
