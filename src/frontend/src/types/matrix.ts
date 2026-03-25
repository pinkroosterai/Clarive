import type { StreamSegment } from '@/hooks/streamingTypes';
import type { EnrichedModel, Evaluation } from '@/services/api/playgroundService';

// ── Cell status ──

export type CellStatus = 'empty' | 'queued' | 'running' | 'completed' | 'error';

// ── Matrix cell — one (version, model) intersection ──

export interface DatasetCellResult {
  rowId: string;
  inputValues: Record<string, string>;
  segments: StreamSegment[];
  score: number | null;
  error: string | null;
}

export interface MatrixCell {
  versionId: string;
  modelId: string;
  status: CellStatus;
  segments: StreamSegment[];
  score: number | null;
  evaluation: Evaluation | null;
  error: string | null;
  elapsedMs: number | null;
  /** Present when running with a dataset — one result per input row */
  datasetResults: DatasetCellResult[];
}

// ── Matrix row — one prompt version ──

export interface MatrixVersion {
  id: string;
  label: string;
  type: 'tab' | 'published' | 'historical';
  version?: number;
  tabName?: string | null;
}

// ── Matrix column — one model ──

export interface MatrixModel {
  modelId: string;
  displayName: string;
  providerName: string;
  temperature: number;
  maxTokens: number;
  reasoningEffort: string;
  isReasoning: boolean;
  showReasoning: boolean;
}

// ── Selected cell identifier ──

export interface CellKey {
  versionId: string;
  modelId: string;
}

// ── Comparison filter ──

export type ComparisonFilter =
  | 'all'
  | { type: 'model'; modelId: string }
  | { type: 'version'; versionId: string };

// ── Overall matrix state ──

export interface MatrixState {
  versions: MatrixVersion[];
  models: MatrixModel[];
  cells: Record<string, MatrixCell>; // key = `${versionId}:${modelId}`
  selectedCell: CellKey | null;
  selectedModelId: string | null;
  selectedVersionId: string | null;
  comparisonFilter: ComparisonFilter;
  datasetId: string | null;
}

// ── Helpers ──

export function cellKey(versionId: string, modelId: string): string {
  return `${versionId}:${modelId}`;
}

export function getCell(state: MatrixState, versionId: string, modelId: string): MatrixCell | undefined {
  return state.cells[cellKey(versionId, modelId)];
}

export function createEmptyCell(versionId: string, modelId: string): MatrixCell {
  return {
    versionId,
    modelId,
    status: 'empty',
    segments: [],
    score: null,
    evaluation: null,
    error: null,
    elapsedMs: null,
    datasetResults: [],
  };
}

export function enrichedModelToMatrixModel(model: EnrichedModel): MatrixModel {
  return {
    modelId: model.modelId,
    displayName: model.displayName ?? model.modelId,
    providerName: model.providerName,
    temperature: model.defaultTemperature ?? 1.0,
    maxTokens: model.defaultMaxTokens ?? 4096,
    reasoningEffort: model.defaultReasoningEffort ?? 'medium',
    isReasoning: model.isReasoning,
    showReasoning: model.isReasoning,
  };
}
