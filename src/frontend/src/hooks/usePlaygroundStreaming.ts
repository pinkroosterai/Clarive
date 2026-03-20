import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

import { mapPlaygroundError, isRateLimitError } from '@/lib/playgroundErrors';
import {
  testEntry,
  type Evaluation,
  type ConversationMessage,
  type ConversationStreamEvent,
} from '@/services/api/playgroundService';
import type { TemplateField } from '@/types';

// ── Streaming status thresholds ──

const STATUS_THRESHOLDS = {
  STILL_GENERATING: 15,
  TAKING_A_WHILE: 30,
} as const;

export function getStreamingStatusMessage(seconds: number): string {
  if (seconds >= STATUS_THRESHOLDS.TAKING_A_WHILE) return 'This is taking a while...';
  if (seconds >= STATUS_THRESHOLDS.STILL_GENERATING) return 'Still generating...';
  return 'Generating...';
}

const CHARS_PER_TOKEN_ESTIMATE = 4;

function estimateTokens(charCount: number): number {
  return Math.round(charCount / CHARS_PER_TOKEN_ESTIMATE);
}

// ── Hook interface ──

export type StreamSegment =
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call'; callId: string; toolName: string; arguments?: string | null }
  | { type: 'tool_result'; callId: string; response?: string | null; error?: string | null; durationMs?: number | null }
  | { type: 'response'; text: string };

export interface UsePlaygroundStreamingOptions {
  entryId: string | undefined;
  model: string;
  temperature: number;
  maxTokens: number;
  templateFields: TemplateField[];
  fieldValues: Record<string, string>;
  reasoningEffort: string;
  showReasoning: boolean;
  isReasoning: boolean;
  mcpServerIds?: string[];
  excludedToolNames?: string[];
}

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
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const rateLimitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Elapsed time + tokens ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [approxOutputTokens, setApproxOutputTokens] = useState(0);
  const streamedTextLengthRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastTokens, setLastTokens] = useState<{
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
  const isAutoFollowRef = useRef(true);
  const scrollRafRef = useRef<number | null>(null);

  // ── Cleanup timers on unmount ──
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  // ── Clear stale reasoning segments when switching to non-reasoning model ──
  useEffect(() => {
    if (!isReasoning && !isStreaming) {
      setSegments((prev) => prev.filter((s) => s.type !== 'reasoning'));
    }
  }, [isReasoning]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-follow scrolling ──
  // The playground page content scrolls within the document/window because the
  // AppShell layout uses min-h-svh with no max constraint. We scroll the
  // document itself rather than trying to find a constrained scroll container.
  useEffect(() => {
    const handleScroll = () => {
      if (!isStreaming) return;
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      isAutoFollowRef.current = isNearBottom;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming || !isAutoFollowRef.current) return;
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      scrollRafRef.current = null;
    });
  }, [segments, isStreaming]);

  // ── Derived values ──
  const hasResponses = useMemo(
    () => segments.some((s) => s.type === 'response' && s.text),
    [segments]
  );
  const responseCount = useMemo(
    () => segments.filter((s) => s.type === 'response').length,
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
    isAutoFollowRef.current = true;
    setRateLimitCountdown(0);
    if (rateLimitTimerRef.current) {
      clearInterval(rateLimitTimerRef.current);
      rateLimitTimerRef.current = null;
    }
    setLastTokens(null);
    setLastRunId(null);
    setLastJudgeScores(null);
    setLastVersionLabel(null);
    setIsJudging(false);
    setConversationLog(null);
    setElapsedSeconds(0);
    setApproxOutputTokens(0);
    streamedTextLengthRef.current = 0;

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      setApproxOutputTokens(estimateTokens(streamedTextLengthRef.current));
    }, 1000);

    const controller = new AbortController();
    abortRef.current = controller;

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
        (evt: ConversationStreamEvent) => {
          // Trigger spinner on first event
          if (!firstTokenRef.current) {
            firstTokenRef.current = true;
            setFirstTokenReceived(true);
          }

          if (evt.type === 'judging') {
            setIsJudging(true);
            return;
          }

          if (evt.type === 'reasoning' && evt.text) {
            setSegments((prev) => {
              const last = prev[prev.length - 1];
              if (last?.type === 'reasoning') {
                // Extend existing reasoning segment
                return [...prev.slice(0, -1), { ...last, text: last.text + evt.text }];
              }
              return [...prev, { type: 'reasoning', text: evt.text! }];
            });
          } else if (evt.type === 'text' && evt.text) {
            streamedTextLengthRef.current += evt.text.length;
            setSegments((prev) => {
              const last = prev[prev.length - 1];
              if (last?.type === 'response') {
                // Extend existing response segment
                return [...prev.slice(0, -1), { ...last, text: last.text + evt.text }];
              }
              return [...prev, { type: 'response', text: evt.text! }];
            });
          } else if (evt.type === 'tool_start' && evt.callId) {
            setSegments((prev) => [
              ...prev,
              {
                type: 'tool_call',
                callId: evt.callId!,
                toolName: evt.toolName ?? 'Unknown',
                arguments: evt.arguments,
              },
            ]);
          } else if (evt.type === 'tool_end' && evt.callId) {
            setSegments((prev) => [
              ...prev,
              {
                type: 'tool_result',
                callId: evt.callId!,
                response: evt.result,
                error: evt.error,
                durationMs: evt.durationMs,
              },
            ]);
          }
        },
        controller.signal
      );

      if (result.inputTokens != null || result.outputTokens != null) {
        setLastTokens({ input: result.inputTokens, output: result.outputTokens });
      }
      setLastRunId(result.runId);
      setLastJudgeScores(result.judgeScores ?? null);
      setLastVersionLabel(result.versionLabel ?? null);
      setIsJudging(false);

      // Store conversation log for pinned run rendering
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
  ]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearCurrentRun = useCallback(() => {
    setSegments([]);
    setError(null);
    setWasStopped(false);
    setLastTokens(null);
    setLastRunId(null);
    setLastJudgeScores(null);
    setLastVersionLabel(null);
    setElapsedSeconds(0);
    setApproxOutputTokens(0);
    streamedTextLengthRef.current = 0;
  }, []);

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
