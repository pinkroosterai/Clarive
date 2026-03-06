import { useCallback, useRef, useState } from 'react';

import type { PromptEntry } from '@/types';

const MAX_DEPTH = 50;
const COALESCE_MS = 1000;

interface UseEntryHistoryReturn {
  /** Push current state as a snapshot before applying a change */
  pushSnapshot: (entry: PromptEntry, force?: boolean) => void;
  /** Undo: returns previous state, or null if stack empty */
  undo: (current: PromptEntry) => PromptEntry | null;
  /** Redo: returns next state, or null if stack empty */
  redo: (current: PromptEntry) => PromptEntry | null;
  /** Clear all history (on save/discard) */
  clear: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
}

export function useEntryHistory(): UseEntryHistoryReturn {
  const pastRef = useRef<PromptEntry[]>([]);
  const futureRef = useRef<PromptEntry[]>([]);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotTimeRef = useRef(0);

  // Counter to force re-renders when stack sizes change
  const [, setTick] = useState(0);
  const tick = () => setTick((t) => t + 1);

  const commitSnapshot = useCallback((entry: PromptEntry) => {
    pastRef.current = [...pastRef.current.slice(-(MAX_DEPTH - 1)), structuredClone(entry)];
    futureRef.current = [];
    lastSnapshotTimeRef.current = Date.now();
    tick();
  }, []);

  const pushSnapshot = useCallback(
    (entry: PromptEntry, force = false) => {
      const now = Date.now();

      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }

      if (force || now - lastSnapshotTimeRef.current > COALESCE_MS) {
        // Immediate snapshot: structural change or enough time elapsed
        commitSnapshot(entry);
      } else {
        // Within coalesce window — defer snapshot
        const snapshot = structuredClone(entry);
        pendingRef.current = setTimeout(() => {
          pastRef.current = [...pastRef.current.slice(-(MAX_DEPTH - 1)), snapshot];
          futureRef.current = [];
          lastSnapshotTimeRef.current = Date.now();
          pendingRef.current = null;
          tick();
        }, COALESCE_MS);
      }
    },
    [commitSnapshot]
  );

  const undo = useCallback((current: PromptEntry): PromptEntry | null => {
    // Flush any pending coalesced snapshot before undoing
    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }

    if (pastRef.current.length === 0) return null;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, structuredClone(current)];
    tick();
    return previous;
  }, []);

  const redo = useCallback((current: PromptEntry): PromptEntry | null => {
    if (futureRef.current.length === 0) return null;
    const next = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, structuredClone(current)];
    tick();
    return next;
  }, []);

  const clear = useCallback(() => {
    if (pendingRef.current) {
      clearTimeout(pendingRef.current);
      pendingRef.current = null;
    }
    pastRef.current = [];
    futureRef.current = [];
    tick();
  }, []);

  return {
    pushSnapshot,
    undo,
    redo,
    clear,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
