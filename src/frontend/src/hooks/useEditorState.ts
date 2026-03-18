import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

import { useEntryHistory } from '@/hooks/useEntryHistory';
import { deepEqual } from '@/lib/deepEqual';
import type { PromptEntry } from '@/types';

export function useEditorState(entryData: PromptEntry | undefined) {
  const [localEntry, setLocalEntry] = useState<PromptEntry | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const localEntryRef = useRef<PromptEntry | null>(null);

  // Sync server data → local state (only when not dirty)
  useEffect(() => {
    if (entryData && !isDirtyRef.current) {
      setLocalEntry(structuredClone(entryData));
    }
  }, [entryData]);

  // Keep refs in sync
  useEffect(() => {
    isDirtyRef.current = isDirty;
    localEntryRef.current = localEntry;
  }, [isDirty, localEntry]);

  // Document title
  const localTitle = localEntry?.title;
  useEffect(() => {
    document.title = localTitle ? `Clarive — ${localTitle}` : 'Clarive — Editor';
  }, [localTitle]);

  // First-edit notice (published entries)
  const [showEditNotice, setShowEditNotice] = useState(false);
  const hasShownEditNotice = useRef(false);

  // Undo/Redo history
  const history = useEntryHistory();
  const isUndoRedoRef = useRef(false);

  const handleChange = useCallback(
    (updated: Partial<PromptEntry>, options?: { force?: boolean }) => {
      if (
        !hasShownEditNotice.current &&
        entryData?.versionState === 'published' &&
        !isDirtyRef.current
      ) {
        hasShownEditNotice.current = true;
        setShowEditNotice(true);
        setTimeout(() => setShowEditNotice(false), 5000);
      }

      if (!isUndoRedoRef.current) {
        const current = localEntryRef.current;
        if (current) history.pushSnapshot(current, options?.force);
        setLocalEntry((prev) => (prev ? { ...prev, ...updated } : prev));
      } else {
        setLocalEntry((prev) => (prev ? { ...prev, ...updated } : prev));
        isUndoRedoRef.current = false;
      }
      setIsDirty(true);
    },
    [history, entryData?.versionState]
  );

  const handleUndo = useCallback(() => {
    if (!localEntryRef.current) return;
    const snapshot = history.undo(localEntryRef.current);
    if (snapshot) {
      isUndoRedoRef.current = true;
      setLocalEntry(snapshot);
      setIsDirty(!deepEqual(snapshot, entryData));
    }
  }, [history, entryData]);

  const handleRedo = useCallback(() => {
    if (!localEntryRef.current) return;
    const snapshot = history.redo(localEntryRef.current);
    if (snapshot) {
      isUndoRedoRef.current = true;
      setLocalEntry(snapshot);
      setIsDirty(!deepEqual(snapshot, entryData));
    }
  }, [history, entryData]);

  // Discard version — incremented on discard to force MarkdownEditor remount
  const [discardVersion, setDiscardVersion] = useState(0);

  const handleDiscard = useCallback(() => {
    if (!entryData) return;
    // Set ref synchronously so the content sync effect and any pending
    // debounced Tiptap updates see the correct dirty state immediately
    isDirtyRef.current = false;
    setLocalEntry(structuredClone(entryData));
    setIsDirty(false);
    setDiscardVersion((v) => v + 1);
    history.clear();
    toast.success('Changes discarded');
  }, [entryData, history]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return {
    localEntry,
    isDirty,
    setIsDirty,
    localEntryRef,
    handleChange,
    handleUndo,
    handleRedo,
    handleDiscard,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    clearHistory: history.clear,
    showEditNotice,
    discardVersion,
  };
}
