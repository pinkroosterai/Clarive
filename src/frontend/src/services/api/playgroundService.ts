import { api } from './apiClient';

import type { ProgressEvent } from '@/types';

export interface TestStreamChunk {
  promptIndex: number;
  text: string;
  type?: 'text' | 'reasoning' | 'tool_start' | 'tool_end';
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  callId?: string;
  arguments?: string;
  error?: string;
  durationMs?: number;
  reasoning?: string;
  promptIndex?: number;
}

export interface TestStreamResult {
  runId: string;
  conversationLog: ConversationMessage[];
  inputTokens: number | null;
  outputTokens: number | null;
  judgeScores: Evaluation | null;
  versionNumber: number | null;
  versionLabel: string | null;
}

export interface TestRunResponse {
  id: string;
  model: string;
  temperature: number;
  maxTokens: number;
  templateFieldValues: Record<string, string> | null;
  conversationLog: ConversationMessage[];
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
  judgeScores?: Evaluation | null;
  versionNumber?: number | null;
  versionLabel?: string | null;
}

export interface Evaluation {
  dimensions: Record<string, EvaluationEntry>;
  averageScore: number;
}

export interface EvaluationEntry {
  score: number;
  feedback: string;
}

export interface TestEntryParams {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  templateFields?: Record<string, string>;
  reasoningEffort?: string;
  showReasoning?: boolean;
  mcpServerIds?: string[];
  excludedToolNames?: string[];
}

export async function testEntry(
  entryId: string,
  params: TestEntryParams,
  onChunk?: (chunk: TestStreamChunk) => void,
  onProgress?: (event: ProgressEvent) => void,
  signal?: AbortSignal
): Promise<TestStreamResult> {
  const body = {
    model: params.model,
    temperature: params.temperature ?? 1.0,
    maxTokens: params.maxTokens ?? 4096,
    templateFields: params.templateFields,
    reasoningEffort: params.reasoningEffort,
    showReasoning: params.showReasoning,
    mcpServerIds: params.mcpServerIds,
    excludedToolNames: params.excludedToolNames,
  };

  if (onChunk) {
    return api.postSSE<TestStreamResult>(
      `/api/entries/${entryId}/test`,
      body,
      (event) => {
        // Dispatch by shape: TestStreamChunk has promptIndex, ProgressEvent has id
        if ('promptIndex' in event) {
          onChunk(event as unknown as TestStreamChunk);
        } else if (onProgress) {
          onProgress(event);
        }
      },
      signal
    );
  }

  return api.post<TestStreamResult>(`/api/entries/${entryId}/test`, body);
}

export async function getTestRuns(entryId: string): Promise<TestRunResponse[]> {
  return api.get<TestRunResponse[]>(`/api/entries/${entryId}/test-runs`);
}

export interface EnrichedModel {
  modelId: string;
  displayName: string | null;
  providerId: string;
  providerName: string;
  isReasoning: boolean;
  supportsFunctionCalling: boolean;
  supportsResponseSchema: boolean;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  defaultTemperature: number | null;
  defaultMaxTokens: number | null;
  defaultReasoningEffort: string | null;
}

export async function getEnrichedModels(): Promise<EnrichedModel[]> {
  const res = await api.get<{ models: EnrichedModel[] }>('/api/ai/available-models');
  return res.models;
}

export async function fillTemplateFields(entryId: string): Promise<Record<string, string>> {
  const res = await api.post<{ values: Record<string, string> }>('/api/ai/fill-template-fields', {
    entryId,
  });
  return res.values;
}
