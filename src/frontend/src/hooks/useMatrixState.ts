import { useReducer, useCallback } from 'react';

import type {
  MatrixState,
  MatrixVersion,
  MatrixModel,
  MatrixCell,
  CellKey,
  CellStatus,
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
      return {
        ...state,
        versions: state.versions.filter((v) => v.id !== action.versionId),
        cells: newCells,
        selectedCell,
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
      return {
        ...state,
        models: state.models.filter((m) => m.modelId !== action.modelId),
        cells: newCells,
        selectedCell,
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

    case 'SET_DATASET':
      return { ...state, datasetId: action.datasetId };

    case 'CLEAR_MATRIX':
      return initialState;

    default:
      return state;
  }
}

// ── Initial state ──

const initialState: MatrixState = {
  versions: [],
  models: [],
  cells: {},
  selectedCell: null,
  datasetId: null,
};

// ── Hook ──

export function useMatrixState() {
  const [state, dispatch] = useReducer(matrixReducer, initialState);

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
    setDataset,
    clearMatrix,
  };
}
