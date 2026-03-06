import { useState, useCallback, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";

import type { Folder } from "@/types";
import type { DragData } from "@/lib/dnd/types";
import { parseFolderIdFromDroppable } from "@/lib/dnd/types";
import { isValidDrop } from "@/lib/dnd/validation";
import { useDndMutations } from "@/hooks/useDndMutations";
import { DndStateContext } from "./useDndState";
import { EntryDragGhost } from "./EntryDragGhost";
import { FolderDragGhost } from "./FolderDragGhost";

// ── DndProvider ────────────────────────────────────────────────────────────
export function DndProvider({ children }: { children: ReactNode }) {
  const [activeItem, setActiveItem] = useState<DragData | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { moveEntry, moveFolder } = useDndMutations();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor),
  );

  const getFolderTree = useCallback(
    (): Folder[] => queryClient.getQueryData(["folders"]) ?? [],
    [queryClient],
  );

  const isValidTarget = useCallback(
    (targetFolderId: string | null): boolean => {
      if (!activeItem) return false;
      return isValidDrop(activeItem, targetFolderId, getFolderTree());
    },
    [activeItem, getFolderTree],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) setActiveItem(data);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { over } = event;
      const dragData = activeItem;

      setActiveItem(null);
      setOverId(null);

      if (!over || !dragData) return;

      const targetFolderId = parseFolderIdFromDroppable(over.id as string);
      // parseFolderIdFromDroppable returns null for root — but also null for
      // unrecognized IDs. We need to verify it's an actual droppable.
      if (targetFolderId === null && over.id !== "droppable:root") return;

      if (!isValidDrop(dragData, targetFolderId, getFolderTree())) return;

      if (dragData.type === "entry") {
        moveEntry.mutate({ id: dragData.entry.id, folderId: targetFolderId });
      } else {
        moveFolder.mutate({ id: dragData.folder.id, newParentId: targetFolderId });
      }
    },
    [activeItem, getFolderTree, moveEntry, moveFolder],
  );

  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
    setOverId(null);
  }, []);

  return (
    <DndStateContext.Provider value={{ activeItem, overId, isValidTarget }}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeItem?.type === "entry" && (
            <EntryDragGhost title={activeItem.entry.title} />
          )}
          {activeItem?.type === "folder" && (
            <FolderDragGhost name={activeItem.folder.name} />
          )}
        </DragOverlay>
      </DndContext>
    </DndStateContext.Provider>
  );
}
