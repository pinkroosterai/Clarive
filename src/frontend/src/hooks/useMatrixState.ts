import { useReducer, useCallback, useEffect } from 'react';

import { safeSessionGet } from '@/components/playground/utils';
import type {
  MatrixState,
  MatrixVersion,
  MatrixModel,
  MatrixCell,
  CellKey,
  CellStatus,
  ComparisonFilter,
} from '@/types/matrix';
import { cellKey, createEmptyCell } from '@/types/matrix';
import type { StreamSegment } from '@/hooks/streamingTypes';
import type { Evaluation } from '@/services/api/playgroundService';

// ── Actions ──

type MatrixAction =
  | { type: 'ADD_VERSION'; version: MatrixVersion }
  | { type: 'REMOVE_VERSION'; versionId: string }
  | { type: 'ADD_MODEL'; model: MatrixModel }
  | { type: 'REMOVE_MODEL'; modelId: string }
  | { type: 'SELECT_CELL'; cell: CellKey | null }
  | {
      type: 'UPDATE_CELL';
      versionId: string;
      modelId: string;
      update: Partial<MatrixCell>;
    }
  | { type: 'SET_DATASET'; datasetId: string | null }
  | { type: 'UPDATE_MODEL_PARAMS'; modelId: string; params: Partial<Pick<MatrixModel, 'temperature' | 'maxTokens' | 'reasoningEffort' | 'showReasoning'>> }
  | { type: 'SELECT_MODEL'; modelId: string | null }
  | { type: 'SELECT_VERSION'; versionId: string | null }
  | { type: 'SET_COMPARISON_FILTER'; filter: ComparisonFilter }
  | { type: 'CLEAR_MATRIX' };

// ── Reducer ──

function matrixReducer(state: MatrixState, action: MatrixAction): MatrixState {
  switch (action.type) {
    case 'ADD_VERSION': {
      if (state.versions.some((v) => v.id === action.version.id)) return state;
      const newCells = { ...state.cells };
      for (const model of state.models) {
        const key = cellKey(action.version.id, model.modelId);
        if (!newCells[key]) {
          newCells[key] = createEmptyCell(action.version.id, model.modelId);
        }
      }
      return { ...state, versions: [...state.versions, action.version], cells: newCells };
    }

    case 'REMOVE_VERSION': {
      const newCells = { ...state.cells };
      for (const model of state.models) {
        delete newCells[cellKey(action.versionId, model.modelId)];
      }
      const selectedCell =
        state.selectedCell?.versionId === action.versionId ? null : state.selectedCell;
      const selectedVersionId =
        state.selectedVersionId === action.versionId ? null : state.selectedVersionId;
      const comparisonFilter =
        state.comparisonFilter !== 'all' &&
        state.comparisonFilter.type === 'version' &&
        state.comparisonFilter.versionId === action.versionId
          ? 'all' as const
          : state.comparisonFilter;
      return {
        ...state,
        versions: state.versions.filter((v) => v.id !== action.versionId),
        cells: newCells,
        selectedCell,
        selectedVersionId,
        comparisonFilter,
      };
    }

    case 'ADD_MODEL': {
      if (state.models.some((m) => m.modelId === action.model.modelId)) return state;
      const newCells = { ...state.cells };
      for (const version of state.versions) {
        const key = cellKey(version.id, action.model.modelId);
        if (!newCells[key]) {
          newCells[key] = createEmptyCell(version.id, action.model.modelId);
        }
      }
      return { ...state, models: [...state.models, action.model], cells: newCells };
    }

    case 'REMOVE_MODEL': {
      const newCells = { ...state.cells };
      for (const version of state.versions) {
        delete newCells[cellKey(version.id, action.modelId)];
      }
      const selectedCell =
        state.selectedCell?.modelId === action.modelId ? null : state.selectedCell;
      const selectedModelId =
        state.selectedModelId === action.modelId ? null : state.selectedModelId;
      const comparisonFilter =
        state.comparisonFilter !== 'all' &&
        state.comparisonFilter.type === 'model' &&
        state.comparisonFilter.modelId === action.modelId
          ? 'all' as const
          : state.comparisonFilter;
      return {
        ...state,
        models: state.models.filter((m) => m.modelId !== action.modelId),
        cells: newCells,
        selectedCell,
        selectedModelId,
        comparisonFilter,
      };
    }

    case 'SELECT_CELL':
      return { ...state, selectedCell: action.cell };

    case 'UPDATE_CELL': {
      const key = cellKey(action.versionId, action.modelId);
      const existing = state.cells[key];
      if (!existing) return state;
      return {
        ...state,
        cells: { ...state.cells, [key]: { ...existing, ...action.update } },
      };
    }

    case 'UPDATE_MODEL_PARAMS': {
      const idx = state.models.findIndex((m) => m.modelId === action.modelId);
      if (idx === -1) return state;
      const models = [...state.models];
      models[idx] = { ...models[idx], ...action.params };
      return { ...state, models };
    }

    case 'SELECT_MODEL': {
      if (action.modelId !== null && !state.models.some((m) => m.modelId === action.modelId)) {
        return state;
      }
      return { ...state, selectedModelId: action.modelId };
    }

    case 'SELECT_VERSION': {
      if (action.versionId !== null && !state.versions.some((v) => v.id === action.versionId)) {
        return state;
      }
      return { ...state, selectedVersionId: action.versionId };
    }

    case 'SET_COMPARISON_FILTER': {
      const f = action.filter;
      if (f !== 'all') {
        if (f.type === 'model' && !state.models.some((m) => m.modelId === f.modelId)) return state;
        if (f.type === 'version' && !state.versions.some((v) => v.id === f.versionId)) return state;
      }
      return { ...state, comparisonFilter: f };
    }

    case 'SET_DATASET':
      return { ...state, datasetId: action.datasetId };

    case 'CLEAR_MATRIX':
      return emptyState;

    default:
      return state;
  }
}

// ── Initial state ──

const emptyState: MatrixState = {
  versions: [],
  models: [],
  cells: {},
  selectedCell: null,
  selectedModelId: null,
  selectedVersionId: null,
  comparisonFilter: 'all',
  datasetId: null,
};

// ── Session storage helpers ──

interface PersistedMatrixConfig {
  versions: MatrixVersion[];
  models: MatrixModel[];
  datasetId: string | null;
}

const STORAGE_SUFFIX = '_config';

function buildSessionKey(entryId: string | undefined): string | null {
  return entryId ? `matrix_${entryId}${STORAGE_SUFFIX}` : null;
}

function loadPersistedState(entryId: string | undefined): MatrixState {
  const key = buildSessionKey(entryId);
  if (!key) return emptyState;

  const config = safeSessionGet<PersistedMatrixConfig | null>(key, null);
  if (!config || config.versions.length === 0 || config.models.length === 0) {
    return emptyState;
  }

  // Rebuild empty cells for each version×model pair
  const cells: Record<string, MatrixCell> = {};
  for (const version of config.versions) {
    for (const model of config.models) {
      cells[cellKey(version.id, model.modelId)] = createEmptyCell(version.id, model.modelId);
    }
  }

  return {
    versions: config.versions,
    models: config.models,
    cells,
    selectedCell: null,
    selectedModelId: null,
    selectedVersionId: null,
    comparisonFilter: 'all',
    datasetId: config.datasetId,
  };
}

// ── Hook ──

export function useMatrixState(entryId?: string) {
  const [state, dispatch] = useReducer(matrixReducer, entryId, loadPersistedState);

  // Persist config (versions, models, datasetId) to sessionStorage on change
  useEffect(() => {
    const key = buildSessionKey(entryId);
    if (!key) return;

    if (state.versions.length === 0 && state.models.length === 0) {
      sessionStorage.removeItem(key);
      return;
    }

    const config: PersistedMatrixConfig = {
      versions: state.versions,
      models: state.models,
      datasetId: state.datasetId,
    };
    sessionStorage.setItem(key, JSON.stringify(config));
  }, [entryId, state.versions, state.models, state.datasetId]);

  const addVersion = useCallback(
    (version: MatrixVersion) => dispatch({ type: 'ADD_VERSION', version }),
    [],
  );

  const removeVersion = useCallback(
    (versionId: string) => dispatch({ type: 'REMOVE_VERSION', versionId }),
    [],
  );

  const addModel = useCallback(
    (model: MatrixModel) => dispatch({ type: 'ADD_MODEL', model }),
    [],
  );

  const removeModel = useCallback(
    (modelId: string) => dispatch({ type: 'REMOVE_MODEL', modelId }),
    [],
  );

  const selectCell = useCallback(
    (cell: CellKey | null) => dispatch({ type: 'SELECT_CELL', cell }),
    [],
  );

  const updateCell = useCallback(
    (
      versionId: string,
      modelId: string,
      update: Partial<MatrixCell>,
    ) => dispatch({ type: 'UPDATE_CELL', versionId, modelId, update }),
    [],
  );

  const updateCellStatus = useCallback(
    (versionId: string, modelId: string, status: CellStatus) =>
      dispatch({ type: 'UPDATE_CELL', versionId, modelId, update: { status } }),
    [],
  );

  const setCellSegments = useCallback(
    (versionId: string, modelId: string, segments: StreamSegment[]) =>
      dispatch({ type: 'UPDATE_CELL', versionId, modelId, update: { segments } }),
    [],
  );

  const setCellResult = useCallback(
    (
      versionId: string,
      modelId: string,
      result: { score: number | null; evaluation: Evaluation | null; elapsedMs: number },
    ) =>
      dispatch({
        type: 'UPDATE_CELL',
        versionId,
        modelId,
        update: { status: 'completed', ...result },
      }),
    [],
  );

  const setCellError = useCallback(
    (versionId: string, modelId: string, error: string) =>
      dispatch({
        type: 'UPDATE_CELL',
        versionId,
        modelId,
        update: { status: 'error', error },
      }),
    [],
  );

  const updateModelParams = useCallback(
    (modelId: string, params: Partial<Pick<MatrixModel, 'temperature' | 'maxTokens' | 'reasoningEffort' | 'showReasoning'>>) =>
      dispatch({ type: 'UPDATE_MODEL_PARAMS', modelId, params }),
    [],
  );

  const selectModel = useCallback(
    (modelId: string | null) => dispatch({ type: 'SELECT_MODEL', modelId }),
    [],
  );

  const selectVersion = useCallback(
    (versionId: string | null) => dispatch({ type: 'SELECT_VERSION', versionId }),
    [],
  );

  const setComparisonFilter = useCallback(
    (filter: ComparisonFilter) => dispatch({ type: 'SET_COMPARISON_FILTER', filter }),
    [],
  );

  const setDataset = useCallback(
    (datasetId: string | null) => dispatch({ type: 'SET_DATASET', datasetId }),
    [],
  );

  const clearMatrix = useCallback(() => dispatch({ type: 'CLEAR_MATRIX' }), []);

  return {
    state,
    addVersion,
    removeVersion,
    addModel,
    removeModel,
    selectCell,
    updateCell,
    updateCellStatus,
    setCellSegments,
    setCellResult,
    setCellError,
    updateModelParams,
    selectModel,
    selectVersion,
    setComparisonFilter,
    setDataset,
    clearMatrix,
  };
}
