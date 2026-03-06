import { useEffect, useRef } from "react";

interface UseEditorKeyboardShortcutsOptions {
  isReadOnly: boolean;
  onSave: () => void;
  onPublish: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function useEditorKeyboardShortcuts({
  isReadOnly,
  onSave,
  onPublish,
  onUndo,
  onRedo,
}: UseEditorKeyboardShortcutsOptions) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onPublishRef = useRef(onPublish);
  onPublishRef.current = onPublish;
  const onUndoRef = useRef(onUndo);
  onUndoRef.current = onUndo;
  const onRedoRef = useRef(onRedo);
  onRedoRef.current = onRedo;

  useEffect(() => {
    if (isReadOnly) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Ctrl/Cmd + S → Save draft
      if (e.key === "s") {
        e.preventDefault();
        onSaveRef.current();
        return;
      }
      // Ctrl/Cmd + Enter → Publish
      if (e.key === "Enter") {
        e.preventDefault();
        onPublishRef.current();
        return;
      }
      // Ctrl/Cmd + Z / Ctrl/Cmd + Shift + Z → Undo/Redo (context-aware)
      if (e.key === "z" || e.key === "Z") {
        // If a Tiptap editor is focused, let Tiptap handle text-level undo/redo
        if (document.activeElement?.closest(".tiptap")) return;

        e.preventDefault();
        if (e.shiftKey) {
          onRedoRef.current();
        } else {
          onUndoRef.current();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isReadOnly]);
}
