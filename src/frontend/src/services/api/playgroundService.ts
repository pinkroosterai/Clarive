import { api } from './apiClient';

export interface TestStreamChunk {
  promptIndex: number;
  text: string;
  type?: 'text' | 'reasoning';
}

export interface TestRunPromptResponse {
  promptIndex: number;
  content: string;
}

export interface TestStreamResult {
  runId: string;
  responses: TestRunPromptResponse[];
  inputTokens: number | null;
  outputTokens: number | null;
  reasoning: string | null;
}

export interface TestRunResponse {
  id: string;
  model: string;
  temperature: number;
  maxTokens: number;
  templateFieldValues: Record<string, string> | null;
  responses: TestRunPromptResponse[];
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string;
}

export interface TestEntryParams {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  templateFields?: Record<string, string>;
  reasoningEffort?: string;
  showReasoning?: boolean;
}

export async function testEntry(
  entryId: string,
  params: TestEntryParams,
  onChunk?: (chunk: TestStreamChunk) => void,
  signal?: AbortSignal
): Promise<TestStreamResult> {
  const body = {
    model: params.model,
    temperature: params.temperature ?? 1.0,
    maxTokens: params.maxTokens ?? 4096,
    templateFields: params.templateFields,
    reasoningEffort: params.reasoningEffort,
    showReasoning: params.showReasoning,
  };

  if (onChunk) {
    return api.postSSE<TestStreamResult>(
      `/api/entries/${entryId}/test`,
      body,
      (event) => {
        // SSE chunk events have the TestStreamChunk shape
        const chunk = event as unknown as TestStreamChunk;
        if (chunk.text !== undefined) {
          onChunk(chunk);
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

export async function getAvailableModels(): Promise<string[]> {
  const res = await api.get<{ models: string[] }>('/api/ai/models');
  return res.models;
}

export interface EnrichedModel {
  modelId: string;
  displayName: string | null;
  providerId: string;
  providerName: string;
  isReasoning: boolean;
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
