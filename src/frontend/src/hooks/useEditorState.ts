import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

import type { PromptEntry } from "@/types";
import { useEntryHistory } from "@/hooks/useEntryHistory";
import { deepEqual } from "@/lib/deepEqual";

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
  }, [isDirty]);

  useEffect(() => {
    localEntryRef.current = localEntry;
  }, [localEntry]);

  // Document title
  const localTitle = localEntry?.title;
  useEffect(() => {
    document.title = localTitle
      ? `Clarive — ${localTitle}`
      : "Clarive — Editor";
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
        entryData?.versionState === "published" &&
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
    [history, entryData?.versionState],
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

  const handleDiscard = useCallback(() => {
    if (!entryData) return;
    setLocalEntry(structuredClone(entryData));
    setIsDirty(false);
    history.clear();
    toast.success("Changes discarded");
  }, [entryData, history]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
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
  };
}
