import type { StreamSegment } from '@/hooks/streamingTypes';
import type { Evaluation } from '@/services/api/playgroundService';

// ── Report metadata ──

export interface ReportMetadata {
  entryTitle: string;
  generatedAt: string;
  totalVersions: number;
  totalModels: number;
  completedCells: number;
}

// ── Section 1: Run Configuration ──

export interface RunConfigEntry {
  modelId: string;
  displayName: string;
  providerName: string;
  temperature: number;
  maxTokens: number;
  reasoningEffort: string;
}

export interface TemplateFieldEntry {
  name: string;
  value: string;
  type: string;
}

// ── Section 2: Rendered Prompts ──

export interface RenderedPromptEntry {
  versionLabel: string;
  systemMessage: string | null;
  renderedPrompts: string[];
}

// ── Section 3: Full Responses ──

export interface FullResponseEntry {
  versionLabel: string;
  modelDisplayName: string;
  segments: StreamSegment[];
  elapsedMs: number | null;
  error: string | null;
}

// ── Section 4: Evaluation Summary ──

export interface EvaluationSummaryEntry {
  versionLabel: string;
  modelDisplayName: string;
  evaluation: Evaluation | null;
  averageScore: number | null;
}

// ── Top-level report data ──

export interface ReportData {
  metadata: ReportMetadata;
  runConfig: RunConfigEntry[];
  templateFields: TemplateFieldEntry[];
  renderedPrompts: RenderedPromptEntry[];
  fullResponses: FullResponseEntry[];
  evaluationSummary: EvaluationSummaryEntry[];
}
