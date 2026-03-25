import { useCallback, useEffect, useRef, useState } from 'react';

import { createStreamEventHandler, type StreamSegment } from './streamingTypes';

import { testEntry, type Evaluation } from '@/services/api/playgroundService';
import type { CellStatus, MatrixState, CellKey } from '@/types/matrix';
import { cellKey } from '@/types/matrix';

interface UseMatrixExecutionOptions {
  entryId: string | undefined;
  state: MatrixState;
  templateFieldValues?: Record<string, string>;
  enabledServerIds?: string[];
  excludedToolNames?: string[];
  updateCellStatus: (versionId: string, modelId: string, status: CellStatus) => void;
  setCellSegments: (versionId: string, modelId: string, segments: StreamSegment[]) => void;
  setCellResult: (
    versionId: string,
    modelId: string,
    result: { score: number | null; evaluation: Evaluation | null; elapsedMs: number },
  ) => void;
  setCellError: (versionId: string, modelId: string, error: string) => void;
  selectCell: (cell: CellKey | null) => void;
}

// Streaming segments are stored in a ref during active streaming to avoid
// dispatching reducer updates on every SSE chunk. Only the detail drawer
// reads from the live ref (via activeStreamSegments state that syncs at 100ms).
// On completion, a single setCellSegments persists the final result.

export function useMatrixExecution({
  entryId,
  state,
  templateFieldValues,
  enabledServerIds,
  excludedToolNames,
  updateCellStatus,
  setCellSegments,
  setCellResult,
  setCellError,
  selectCell,
}: UseMatrixExecutionOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const [activeStreamSegments, setActiveStreamSegments] = useState<StreamSegment[]>([]);
  const [activeStreamKey, setActiveStreamKey] = useState<string>('');

  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeStreamRef = useRef<{ key: string; segments: StreamSegment[] }>({
    key: '',
    segments: [],
  });
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync active stream ref to state at 100ms intervals for the detail drawer
  const startStreamSync = useCallback((key: string) => {
    activeStreamRef.current = { key, segments: [] };
    setActiveStreamKey(key);
    setActiveStreamSegments([]);

    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      if (activeStreamRef.current.key === key) {
        setActiveStreamSegments([...activeStreamRef.current.segments]);
      }
    }, 100);
  }, []);

  const stopStreamSync = useCallback(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    // Final sync
    setActiveStreamSegments([...activeStreamRef.current.segments]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      for (const controller of abortControllersRef.current.values()) {
        controller.abort();
      }
      abortControllersRef.current.clear();
    };
  }, []);

  const runSingle = useCallback(
    async (versionId: string, modelId: string) => {
      if (!entryId) return;

      const model = state.models.find((m) => m.modelId === modelId);
      if (!model) return;

      const key = cellKey(versionId, modelId);
      const existingAbort = abortControllersRef.current.get(key);
      if (existingAbort) existingAbort.abort();

      const controller = new AbortController();
      abortControllersRef.current.set(key, controller);

      updateCellStatus(versionId, modelId, 'running');
      selectCell({ versionId, modelId });
      startStreamSync(key);

      const firstTokenRef = { current: false };
      const startTime = Date.now();

      const handler = createStreamEventHandler({
        firstTokenRef,
        setFirstTokenReceived: () => {},
        setIsJudging: () => {},
        setSegments: (updater) => {
          const ref = activeStreamRef.current;
          if (typeof updater === 'function') {
            const next = updater(ref.segments);
            ref.segments = next;
          } else {
            ref.segments = updater;
          }
          // No dispatch here — ref is synced to state via the 100ms timer
        },
        addStreamedChars: () => {},
      });

      try {
        const result = await testEntry(
          entryId,
          {
            model: model.modelId,
            temperature: model.temperature,
            maxTokens: model.maxTokens,
            reasoningEffort: model.isReasoning ? model.reasoningEffort : undefined,
            showReasoning: model.showReasoning,
            templateFields: templateFieldValues,
            tabId: versionId,
            mcpServerIds: enabledServerIds?.length ? enabledServerIds : undefined,
            excludedToolNames: excludedToolNames?.length ? excludedToolNames : undefined,
          },
          handler,
          controller.signal,
        );

        stopStreamSync();
        const elapsedMs = Date.now() - startTime;
        const avgScore = result.judgeScores?.averageScore ?? null;

        // Persist final segments to matrix state (single dispatch)
        setCellSegments(versionId, modelId, [...activeStreamRef.current.segments]);
        setCellResult(versionId, modelId, {
          score: avgScore,
          evaluation: result.judgeScores,
          elapsedMs,
        });
      } catch (err) {
        stopStreamSync();
        if (controller.signal.aborted) {
          updateCellStatus(versionId, modelId, 'empty');
        } else {
          const message = err instanceof Error ? err.message : 'Unknown error';
          setCellError(versionId, modelId, message);
        }
      } finally {
        abortControllersRef.current.delete(key);
      }
    },
    [entryId, state.models, templateFieldValues, enabledServerIds, excludedToolNames, updateCellStatus, selectCell, startStreamSync, stopStreamSync, setCellSegments, setCellResult, setCellError],
  );

  // Shared batch runner — eliminates duplication across runAll/runRow/runColumn
  const runBatch = useCallback(
    async (queue: { versionId: string; modelId: string }[]) => {
      if (queue.length === 0) return;
      setIsRunning(true);
      setBatchProgress({ current: 0, total: queue.length });
      for (let i = 0; i < queue.length; i++) {
        setBatchProgress({ current: i + 1, total: queue.length });
        await runSingle(queue[i].versionId, queue[i].modelId);
      }
      setIsRunning(false);
      setBatchProgress(null);
    },
    [runSingle],
  );

  const runAll = useCallback(async () => {
    if (!entryId) return;
    const queue: { versionId: string; modelId: string }[] = [];
    for (const version of state.versions) {
      for (const model of state.models) {
        const key = cellKey(version.id, model.modelId);
        const cell = state.cells[key];
        if (!cell || cell.status === 'empty' || cell.status === 'error') {
          queue.push({ versionId: version.id, modelId: model.modelId });
        }
      }
    }
    await runBatch(queue);
  }, [entryId, state.versions, state.models, state.cells, runBatch]);

  const runRow = useCallback(
    async (versionId: string) => {
      if (!entryId) return;
      await runBatch(state.models.map((m) => ({ versionId, modelId: m.modelId })));
    },
    [entryId, state.models, runBatch],
  );

  const runColumn = useCallback(
    async (modelId: string) => {
      if (!entryId) return;
      await runBatch(state.versions.map((v) => ({ versionId: v.id, modelId })));
    },
    [entryId, state.versions, runBatch],
  );

  const abortAll = useCallback(() => {
    for (const controller of abortControllersRef.current.values()) {
      controller.abort();
    }
    abortControllersRef.current.clear();
    stopStreamSync();
    setIsRunning(false);
    setBatchProgress(null);
  }, [stopStreamSync]);

  const abortCell = useCallback((versionId: string, modelId: string) => {
    const key = cellKey(versionId, modelId);
    const controller = abortControllersRef.current.get(key);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(key);
    }
  }, []);

  return {
    isRunning,
    batchProgress,
    activeStreamSegments,
    activeStreamKey,
    runSingle,
    runAll,
    runRow,
    runColumn,
    abortAll,
    abortCell,
  };
}
