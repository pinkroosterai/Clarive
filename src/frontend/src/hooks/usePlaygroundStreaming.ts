import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

import { mapPlaygroundError, isRateLimitError } from '@/lib/playgroundErrors';
import { testEntry, type TestStreamChunk, type Evaluation } from '@/services/api/playgroundService';
import type { ProgressEvent, TemplateField } from '@/types';

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

export interface ToolCallState {
  toolName: string;
  arguments: string | null;
  response: string | null;
  durationMs: number | null;
  error: string | null;
  status: 'calling' | 'complete' | 'error';
}

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
  const [streamedResponses, setStreamedResponses] = useState<Record<number, string>>({});
  const [streamedReasoning, setStreamedReasoning] = useState<Record<number, string>>({});
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
  const [toolCalls, setToolCalls] = useState<Record<string, ToolCallState>>({});

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

  // ── Clear stale reasoning when switching to non-reasoning model ──
  useEffect(() => {
    if (!isReasoning && !isStreaming) {
      setStreamedReasoning({});
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
  }, [streamedResponses, streamedReasoning, isStreaming]);

  // ── Derived values ──
  // Which prompt is currently being processed? Defaults to 0 when streaming
  // starts (before any content arrives), so the spinner shows immediately.
  const currentPromptIndex = useMemo(() => {
    if (!isStreaming) return -1;
    const indices = new Set([
      ...Object.keys(streamedResponses).map(Number),
      ...Object.keys(streamedReasoning).map(Number),
    ]);
    return indices.size > 0 ? Math.max(...indices) : 0;
  }, [streamedResponses, streamedReasoning, isStreaming]);
  const responseCount = useMemo(() => Object.keys(streamedResponses).length, [streamedResponses]);
  const hasResponses = responseCount > 0;

  // ── Handlers ──
  const handleRun = useCallback(async () => {
    if (!entryId) return;
    setIsStreaming(true);
    setFirstTokenReceived(false);
    firstTokenRef.current = false;
    setStreamedResponses({});
    setStreamedReasoning({});
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
    setToolCalls({});
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
        (chunk: TestStreamChunk) => {
          // Trigger spinner on first chunk of any type (text or reasoning)
          if (!firstTokenRef.current && chunk.text !== undefined) {
            firstTokenRef.current = true;
            setFirstTokenReceived(true);
          }
          if (chunk.type === 'judging') {
            setIsJudging(true);
            return;
          }
          if (!chunk.text) return;
          if (chunk.type === 'reasoning') {
            setStreamedReasoning((prev) => ({
              ...prev,
              [chunk.promptIndex]: (prev[chunk.promptIndex] || '') + chunk.text,
            }));
          } else {
            streamedTextLengthRef.current += chunk.text.length;
            setStreamedResponses((prev) => ({
              ...prev,
              [chunk.promptIndex]: (prev[chunk.promptIndex] || '') + chunk.text,
            }));
          }
        },
        (evt: ProgressEvent) => {
          if (evt.type === 'tool_start') {
            setToolCalls((prev) => ({
              ...prev,
              [evt.id]: {
                toolName: evt.message?.replace('Calling ', '').replace('\u2026', '') || 'Unknown',
                arguments: evt.detail || null,
                response: null,
                durationMs: null,
                error: null,
                status: 'calling',
              },
            }));
          } else if (evt.type === 'tool_end') {
            setToolCalls((prev) => {
              const existing = prev[evt.id];
              if (!existing) return prev;
              return {
                ...prev,
                [evt.id]: { ...existing, status: 'complete' },
              };
            });
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

      // Populate tool calls with full invocation data from result
      if (result.toolInvocations && result.toolInvocations.length > 0) {
        setToolCalls((prev) => {
          const updated = { ...prev };
          for (const inv of result.toolInvocations!) {
            updated[inv.callId] = {
              toolName: inv.toolName,
              arguments: inv.arguments,
              response: inv.response,
              durationMs: inv.durationMs,
              error: inv.error,
              status: inv.error ? 'error' : 'complete',
            };
          }
          return updated;
        });
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
  ]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearCurrentRun = useCallback(() => {
    setStreamedResponses({});
    setStreamedReasoning({});
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
    streamedResponses,
    streamedReasoning,
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
    currentPromptIndex,
    responseCount,
    toolCalls,
    handleRun,
    handleAbort,
    clearCurrentRun,
    responseAreaRef,
  };
}
