import { api } from './apiClient';

import type {
  PromptEntry,
  Prompt,
  ClarificationQuestion,
  Evaluation,
  IterationScore,
} from '@/types';

export interface PreGenClarifyResult {
  sessionId: string;
  questions: ClarificationQuestion[];
  enhancements: string[];
}

export interface WizardResult {
  sessionId: string;
  draft: PromptEntry;
  questions: ClarificationQuestion[];
  enhancements: string[];
  evaluation?: Evaluation;
  scoreHistory?: IterationScore[];
}

interface ApiDraft {
  title: string;
  systemMessage: string | null;
  folderId: string | null;
  prompts: Array<{ content: string; isTemplate?: boolean }>;
}

interface ApiClarificationQuestion {
  text: string;
  suggestions: string[];
}

interface ApiEvaluation {
  dimensions: Record<string, { score: number; feedback: string }>;
}

interface ApiIterationScore {
  iteration: number;
  scores: Record<string, { score: number; feedback: string }>;
  averageScore: number;
}

interface GenerateApiResponse {
  sessionId: string;
  draft: ApiDraft;
  questions: ApiClarificationQuestion[];
  enhancements: string[];
  evaluation?: ApiEvaluation;
  scoreHistory?: ApiIterationScore[];
}

interface PreGenClarifyApiResponse {
  sessionId: string;
  questions: ApiClarificationQuestion[];
  enhancements: string[];
}

function apiDraftToEntry(draft: ApiDraft): PromptEntry {
  const now = new Date().toISOString();
  return {
    id: '',
    title: draft.title,
    systemMessage: draft.systemMessage,
    prompts: draft.prompts.map((p, i) => ({
      id: `draft-${i}`,
      content: p.content,
      order: i,
    })),
    folderId: draft.folderId,
    version: 1,
    versionState: 'draft',
    isTrashed: false,
    createdAt: now,
    updatedAt: now,
    createdBy: '',
    isTemplate: draft.prompts.some((p) => p.isTemplate),
    isChain: draft.prompts.length > 1,
  };
}

function toWizardResult(res: GenerateApiResponse): WizardResult {
  return {
    sessionId: res.sessionId,
    draft: apiDraftToEntry(res.draft),
    questions: res.questions,
    enhancements: res.enhancements,
    evaluation: res.evaluation,
    scoreHistory: res.scoreHistory,
  };
}

export async function preGenClarify(
  description: string,
  options?: {
    generateSystemMessage?: boolean;
    generateTemplate?: boolean;
    generateChain?: boolean;
    toolIds?: string[];
  },
  onProgress?: (stage: string) => void
): Promise<PreGenClarifyResult> {
  const body = {
    description,
    generateSystemMessage: options?.generateSystemMessage ?? false,
    generateTemplate: options?.generateTemplate ?? false,
    generateChain: options?.generateChain ?? false,
    toolIds: options?.toolIds,
  };
  const res = onProgress
    ? await api.postSSE<PreGenClarifyApiResponse>('/api/ai/pre-gen-clarify', body, onProgress)
    : await api.post<PreGenClarifyApiResponse>('/api/ai/pre-gen-clarify', body);
  return {
    sessionId: res.sessionId,
    questions: res.questions,
    enhancements: res.enhancements,
  };
}

export async function generatePrompt(
  description: string,
  options?: {
    generateSystemMessage?: boolean;
    generateTemplate?: boolean;
    generateChain?: boolean;
    toolIds?: string[];
    sessionId?: string;
    preGenAnswers?: Array<{ questionIndex: number; answer: string }>;
    selectedEnhancements?: number[];
  },
  onProgress?: (stage: string) => void
): Promise<WizardResult> {
  const body = {
    description,
    generateSystemMessage: options?.generateSystemMessage ?? false,
    generateTemplate: options?.generateTemplate ?? false,
    generateChain: options?.generateChain ?? false,
    toolIds: options?.toolIds,
    sessionId: options?.sessionId,
    preGenAnswers: options?.preGenAnswers,
    selectedEnhancements: options?.selectedEnhancements,
  };
  const res = onProgress
    ? await api.postSSE<GenerateApiResponse>('/api/ai/generate', body, onProgress)
    : await api.post<GenerateApiResponse>('/api/ai/generate', body);
  return toWizardResult(res);
}

export async function refinePrompt(
  sessionId: string,
  answers?: Array<{ questionIndex: number; answer: string }>,
  selectedEnhancements?: number[],
  onProgress?: (stage: string) => void
): Promise<WizardResult> {
  const body = {
    sessionId,
    answers,
    selectedEnhancements,
  };
  const res = onProgress
    ? await api.postSSE<GenerateApiResponse>('/api/ai/refine', body, onProgress)
    : await api.post<GenerateApiResponse>('/api/ai/refine', body);
  return toWizardResult(res);
}

export async function enhanceEntry(
  entryId: string,
  onProgress?: (stage: string) => void
): Promise<WizardResult> {
  const body = { entryId };
  const res = onProgress
    ? await api.postSSE<GenerateApiResponse>('/api/ai/enhance', body, onProgress)
    : await api.post<GenerateApiResponse>('/api/ai/enhance', body);
  return toWizardResult(res);
}

export async function generateSystemMessage(entryId: string): Promise<string> {
  const res = await api.post<{ systemMessage: string }>('/api/ai/generate-system-message', {
    entryId,
  });
  return res.systemMessage;
}

export async function decomposeToChain(entryId: string): Promise<Prompt[]> {
  const res = await api.post<{
    prompts: Array<{ content: string }>;
  }>('/api/ai/decompose', { entryId });

  return res.prompts.map((p, i) => ({
    id: `decomposed-${i}`,
    content: p.content,
    order: i,
  }));
}
