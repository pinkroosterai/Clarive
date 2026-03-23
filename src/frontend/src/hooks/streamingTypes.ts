import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ConversationStreamEvent } from '@/services/api/playgroundService';
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

// ── Types ──

export type StreamSegment =
  | { type: 'reasoning'; text: string; promptIndex: number }
  | {
      type: 'tool_call';
      callId: string;
      toolName: string;
      arguments?: string | null;
      promptIndex: number;
    }
  | {
      type: 'tool_result';
      callId: string;
      response?: string | null;
      error?: string | null;
      durationMs?: number | null;
      promptIndex: number;
    }
  | { type: 'response'; text: string; promptIndex: number };

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

// ── SSE event handler factory ──

interface StreamEventHandlerDeps {
  firstTokenRef: MutableRefObject<boolean>;
  setFirstTokenReceived: (v: boolean) => void;
  setIsJudging: (v: boolean) => void;
  setSegments: Dispatch<SetStateAction<StreamSegment[]>>;
  addStreamedChars: (count: number) => void;
}

export function createStreamEventHandler({
  firstTokenRef,
  setFirstTokenReceived,
  setIsJudging,
  setSegments,
  addStreamedChars,
}: StreamEventHandlerDeps) {
  return (evt: ConversationStreamEvent) => {
    if (!firstTokenRef.current) {
      firstTokenRef.current = true;
      setFirstTokenReceived(true);
    }

    if (evt.type === 'judging') {
      setIsJudging(true);
      return;
    }

    const pi = evt.promptIndex ?? 0;

    if (evt.type === 'reasoning' && evt.text) {
      setSegments((prev) => {
        const last = prev[prev.length - 1];
        if (last?.type === 'reasoning' && last.promptIndex === pi) {
          return [...prev.slice(0, -1), { ...last, text: last.text + evt.text }];
        }
        return [...prev, { type: 'reasoning', text: evt.text!, promptIndex: pi }];
      });
    } else if (evt.type === 'text' && evt.text) {
      addStreamedChars(evt.text.length);
      setSegments((prev) => {
        const last = prev[prev.length - 1];
        if (last?.type === 'response' && last.promptIndex === pi) {
          return [...prev.slice(0, -1), { ...last, text: last.text + evt.text }];
        }
        return [...prev, { type: 'response', text: evt.text!, promptIndex: pi }];
      });
    } else if (evt.type === 'tool_start' && evt.callId) {
      setSegments((prev) => [
        ...prev,
        {
          type: 'tool_call',
          callId: evt.callId!,
          toolName: evt.toolName ?? 'Unknown',
          arguments: evt.arguments,
          promptIndex: pi,
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
          promptIndex: pi,
        },
      ]);
    }
  };
}
