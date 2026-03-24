import { api } from './apiClient';

// ── Types ──

export interface AbTestRun {
  id: string;
  versionA: number;
  versionB: number;
  datasetName: string | null;
  model: string;
  status: string;
  resultCount: number;
  createdAt: string;
  completedAt: string | null;
}

export interface AbTestRunDetail extends AbTestRun {
  results: AbTestResult[];
  summary: AggregateSummary | null;
}

export interface AbTestResult {
  id: string;
  datasetRowId: string;
  inputValues: Record<string, string> | null;
  versionAOutput: string | null;
  versionBOutput: string | null;
  versionAScores: Record<string, { score: number; feedback: string }> | null;
  versionBScores: Record<string, { score: number; feedback: string }> | null;
  versionAAvgScore: number | null;
  versionBAvgScore: number | null;
}

export interface AggregateSummary {
  versionAAvg: number;
  versionBAvg: number;
  deltaPercent: number;
  versionAWins: number;
  versionBWins: number;
  ties: number;
  perDimension: Record<string, { versionAAvg: number; versionBAvg: number; delta: number }>;
}

export interface AbTestProgressEvent {
  type: string;
  currentRow: number;
  totalRows: number;
  versionLabel: string | null;
  message: string | null;
}

export interface StartAbTestRequest {
  versionANumber: number;
  versionBNumber: number;
  datasetId: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// ── API Functions ──

export async function startAbTest(
  entryId: string,
  request: StartAbTestRequest,
  onEvent?: (event: AbTestProgressEvent) => void,
  signal?: AbortSignal
): Promise<AbTestRunDetail> {
  if (onEvent) {
    return api.postSSE<AbTestRunDetail>(
      `/api/entries/${entryId}/abtests`,
      request,
      (event) => {
        onEvent(event as unknown as AbTestProgressEvent);
      },
      signal
    );
  }

  return api.post<AbTestRunDetail>(`/api/entries/${entryId}/abtests`, request);
}

export async function getAbTests(entryId: string): Promise<AbTestRun[]> {
  return api.get<AbTestRun[]>(`/api/entries/${entryId}/abtests`);
}

export async function getAbTest(entryId: string, runId: string): Promise<AbTestRunDetail> {
  return api.get<AbTestRunDetail>(`/api/entries/${entryId}/abtests/${runId}`);
}

export async function deleteAbTest(entryId: string, runId: string): Promise<void> {
  return api.delete(`/api/entries/${entryId}/abtests/${runId}`);
}
