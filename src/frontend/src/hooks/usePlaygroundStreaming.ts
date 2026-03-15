import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { mapPlaygroundError, isRateLimitError } from '@/lib/playgroundErrors';
import {
  testEntry,
  type TestStreamChunk,
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
  const [lastTokens, setLastTokens] = useState<{ input: number | null; output: number | null } | null>(null);

  // ── Scroll refs ──
  const responseAreaRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
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

  // ── Auto-follow scrolling ──
  useEffect(() => {
    const el = document.querySelector('[data-radix-scroll-area-viewport]');
    if (el) scrollViewportRef.current = el as HTMLDivElement;
  }, []);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      if (!isStreaming) return;
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      isAutoFollowRef.current = isNearBottom;
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [isStreaming]);

  useEffect(() => {
    if (!isStreaming || !isAutoFollowRef.current) return;
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      const viewport = scrollViewportRef.current;
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
      scrollRafRef.current = null;
    });
  }, [streamedResponses, streamedReasoning, isStreaming]);

  // ── Derived values ──
  const activePromptIndex = useMemo(() => {
    const indices = Object.keys(streamedResponses).map(Number);
    return indices.length > 0 ? Math.max(...indices) : -1;
  }, [streamedResponses]);
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
        },
        (chunk: TestStreamChunk) => {
          if (!chunk.text) return;
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
            streamedTextLengthRef.current += chunk.text.length;
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
  }, [entryId, model, temperature, maxTokens, fieldValues, templateFields, queryClient, showReasoning, reasoningEffort, isReasoning]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
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
    hasResponses,
    activePromptIndex,
    responseCount,
    handleRun,
    handleAbort,
    responseAreaRef,
  };
}
