import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

import {
  createStreamEventHandler,
  type StreamSegment,
  type UsePlaygroundStreamingOptions,
} from './streamingTypes';
import { usePlaygroundAutoScroll } from './usePlaygroundAutoScroll';

import { mapPlaygroundError, isRateLimitError } from '@/lib/playgroundErrors';
import {
  testEntry,
  type Evaluation,
  type ConversationMessage,
} from '@/services/api/playgroundService';

// Re-export types for backward compatibility
export type { StreamSegment, UsePlaygroundStreamingOptions } from './streamingTypes';

// ── Constants ──

const CHARS_PER_TOKEN_ESTIMATE = 4;

function estimateTokens(charCount: number): number {
  return Math.round(charCount / CHARS_PER_TOKEN_ESTIMATE);
}

// ── Sub-hook: Streaming timer ──

function useStreamingTimer() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [approxOutputTokens, setApproxOutputTokens] = useState(0);
  const streamedTextLengthRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setElapsedSeconds(0);
    setApproxOutputTokens(0);
    streamedTextLengthRef.current = 0;
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      setApproxOutputTokens(estimateTokens(streamedTextLengthRef.current));
    }, 1000);
    return startTime;
  }, []);

  const stopTimer = useCallback((startTime: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
  }, []);

  const addStreamedChars = useCallback((count: number) => {
    streamedTextLengthRef.current += count;
  }, []);

  const resetTimer = useCallback(() => {
    setElapsedSeconds(0);
    setApproxOutputTokens(0);
    streamedTextLengthRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    elapsedSeconds,
    approxOutputTokens,
    startTimer,
    stopTimer,
    addStreamedChars,
    resetTimer,
  };
}

// ── Sub-hook: Rate limit countdown ──

function useRateLimitCountdown() {
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback((seconds: number) => {
    setRateLimitCountdown(seconds);
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
  }, []);

  const resetCountdown = useCallback(() => {
    setRateLimitCountdown(0);
    if (rateLimitTimerRef.current) {
      clearInterval(rateLimitTimerRef.current);
      rateLimitTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
    };
  }, []);

  return { rateLimitCountdown, startCountdown, resetCountdown };
}

// ── Main hook ──

export function usePlaygroundStreaming({
  entryId,
  model,
  temperature,
  maxTokens,
  templateFields,
  fieldValues,
  reasoningEffort,
  showReasoning,
  isReasoning,
  mcpServerIds,
  excludedToolNames,
}: UsePlaygroundStreamingOptions) {
  const queryClient = useQueryClient();

  // ── Streaming state ──
  const [isStreaming, setIsStreaming] = useState(false);
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const firstTokenRef = useRef(false);
  const [segments, setSegments] = useState<StreamSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [wasStopped, setWasStopped] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Composed sub-hooks ──
  const {
    elapsedSeconds,
    approxOutputTokens,
    startTimer,
    stopTimer,
    addStreamedChars,
    resetTimer,
  } = useStreamingTimer();
  const { rateLimitCountdown, startCountdown, resetCountdown } = useRateLimitCountdown();

  // ── Run result state ──
  const [lastTokens, setLastTokens] = useState<{
    input: number | null;
    output: number | null;
  } | null>(null);
  const [lastCost, setLastCost] = useState<{
    input: number | null;
    output: number | null;
  } | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [lastJudgeScores, setLastJudgeScores] = useState<Evaluation | null>(null);
  const [lastVersionLabel, setLastVersionLabel] = useState<string | null>(null);
  const [isJudging, setIsJudging] = useState(false);
  const [conversationLog, setConversationLog] = useState<ConversationMessage[] | null>(null);

  // ── Scroll refs ──
  const responseAreaRef = useRef<HTMLDivElement>(null);

  // ── Auto-follow scrolling (extracted hook) ──
  const { resetAutoFollow } = usePlaygroundAutoScroll(isStreaming, segments);

  // ── Clear stale reasoning segments when switching to non-reasoning model ──
  useEffect(() => {
    if (!isReasoning && !isStreaming) {
      setSegments((prev) => prev.filter((s) => s.type !== 'reasoning'));
    }
  }, [isReasoning]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ──
  const hasResponses = useMemo(
    () => segments.some((s) => s.type === 'response' && s.text),
    [segments]
  );
  const responseCount = useMemo(
    () => new Set(segments.filter((s) => s.type === 'response').map((s) => s.promptIndex)).size,
    [segments]
  );

  // ── Handlers ──
  const handleRun = useCallback(async () => {
    if (!entryId) return;
    setIsStreaming(true);
    setFirstTokenReceived(false);
    firstTokenRef.current = false;
    setSegments([]);
    setError(null);
    setWasStopped(false);
    resetAutoFollow();
    resetCountdown();
    setLastTokens(null);
    setLastCost(null);
    setLastRunId(null);
    setLastJudgeScores(null);
    setLastVersionLabel(null);
    setIsJudging(false);
    setConversationLog(null);

    const startTime = startTimer();
    const controller = new AbortController();
    abortRef.current = controller;

    const onStreamEvent = createStreamEventHandler({
      firstTokenRef,
      setFirstTokenReceived,
      setIsJudging,
      setSegments,
      addStreamedChars,
    });

    try {
      const result = await testEntry(
        entryId,
        {
          model: model || undefined,
          temperature,
          maxTokens,
          templateFields: templateFields.length > 0 ? fieldValues : undefined,
          reasoningEffort: isReasoning && showReasoning ? reasoningEffort : undefined,
          showReasoning: isReasoning ? showReasoning : undefined,
          mcpServerIds: mcpServerIds?.length ? mcpServerIds : undefined,
          excludedToolNames: excludedToolNames?.length ? excludedToolNames : undefined,
        },
        onStreamEvent,
        controller.signal
      );

      if (result.inputTokens != null || result.outputTokens != null) {
        setLastTokens({ input: result.inputTokens, output: result.outputTokens });
      }
      if (result.estimatedInputCostUsd != null || result.estimatedOutputCostUsd != null) {
        setLastCost({ input: result.estimatedInputCostUsd, output: result.estimatedOutputCostUsd });
      }
      setLastRunId(result.runId);
      setLastJudgeScores(result.judgeScores ?? null);
      setLastVersionLabel(result.versionLabel ?? null);
      setIsJudging(false);

      if (result.conversationLog?.length) {
        setConversationLog(result.conversationLog);
      }

      queryClient.invalidateQueries({ queryKey: ['playground', 'runs', entryId] });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast.info('Generation stopped');
        setWasStopped(true);
      } else {
        const rawMessage = err instanceof Error ? err.message : 'Test failed';
        setError(rawMessage);
        if (isRateLimitError(rawMessage)) {
          startCountdown(60);
        }
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      stopTimer(startTime);
    }
  }, [
    entryId,
    model,
    temperature,
    maxTokens,
    fieldValues,
    templateFields,
    queryClient,
    showReasoning,
    reasoningEffort,
    isReasoning,
    mcpServerIds,
    excludedToolNames,
    startTimer,
    stopTimer,
    addStreamedChars,
    resetCountdown,
    startCountdown,
  ]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearCurrentRun = useCallback(() => {
    setSegments([]);
    setError(null);
    setWasStopped(false);
    setLastTokens(null);
    setLastCost(null);
    setLastRunId(null);
    setLastJudgeScores(null);
    setLastVersionLabel(null);
    resetTimer();
  }, [resetTimer]);

  return {
    isStreaming,
    firstTokenReceived,
    segments,
    error,
    wasStopped,
    rateLimitCountdown,
    elapsedSeconds,
    approxOutputTokens,
    lastTokens,
    lastCost,
    lastRunId,
    lastJudgeScores,
    lastVersionLabel,
    isJudging,
    hasResponses,
    responseCount,
    conversationLog,
    handleRun,
    handleAbort,
    clearCurrentRun,
    responseAreaRef,
  };
}
