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
} from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';

import { EntryDragGhost } from './EntryDragGhost';
import { FolderDragGhost } from './FolderDragGhost';
import { DndStateContext } from './useDndState';

import { useDndMutations } from '@/hooks/useDndMutations';
import type { DragData } from '@/lib/dnd/types';
import { parseFolderIdFromDroppable } from '@/lib/dnd/types';
import { isValidDrop } from '@/lib/dnd/validation';
import { findFolderName } from '@/lib/folderUtils';
import type { Folder } from '@/types';

interface PreMoveState {
  type: 'entry' | 'folder';
  itemId: string;
  itemName: string;
  previousParentId: string | null;
  targetFolderId: string | null;
}

// ── DndProvider ────────────────────────────────────────────────────────────
export function DndProvider({ children }: { children: ReactNode }) {
  const [activeItem, setActiveItem] = useState<DragData | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const preMoveRef = useRef<PreMoveState | null>(null);
  const queryClient = useQueryClient();

  const getFolderTree = useCallback(
    (): Folder[] => queryClient.getQueryData(['folders']) ?? [],
    [queryClient]
  );

  const { moveEntry, moveFolder } = useDndMutations({
    onEntryMoved: () => {
      const pre = preMoveRef.current;
      if (!pre) { toast.success('Entry moved'); return; }
      const folders = getFolderTree();
      const destName = findFolderName(folders, pre.targetFolderId);
      showUndoToast(pre, destName);
    },
    onFolderMoved: () => {
      const pre = preMoveRef.current;
      if (!pre) { toast.success('Folder moved'); return; }
      const folders = getFolderTree();
      const destName = findFolderName(folders, pre.targetFolderId);
      showUndoToast(pre, destName);
    },
  });

  const showUndoToast = useCallback(
    (pre: PreMoveState, destinationName: string) => {
      toast(`Moved "${pre.itemName}"`, {
        description: `to ${destinationName === 'Root' ? 'Root' : `"${destinationName}"`}`,
        action: {
          label: 'Undo',
          onClick: () => {
            if (pre.type === 'entry') {
              moveEntry.mutate({ id: pre.itemId, folderId: pre.previousParentId });
            } else {
              moveFolder.mutate({ id: pre.itemId, newParentId: pre.previousParentId });
            }
          },
        },
        duration: 5000,
      });
    },
    [moveEntry, moveFolder]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor)
  );

  const isValidTarget = useCallback(
    (targetFolderId: string | null): boolean => {
      if (!activeItem) return false;
      return isValidDrop(activeItem, targetFolderId);
    },
    [activeItem]
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
      if (targetFolderId === null && over.id !== 'droppable:root') return;

      if (!isValidDrop(dragData, targetFolderId)) return;

      // Capture pre-move state before mutation
      if (dragData.type === 'entry') {
        preMoveRef.current = {
          type: 'entry',
          itemId: dragData.entry.id,
          itemName: dragData.entry.title,
          previousParentId: dragData.entry.folderId,
          targetFolderId,
        };
        moveEntry.mutate({ id: dragData.entry.id, folderId: targetFolderId });
      } else {
        preMoveRef.current = {
          type: 'folder',
          itemId: dragData.folder.id,
          itemName: dragData.folder.name,
          previousParentId: dragData.folder.parentId,
          targetFolderId,
        };
        moveFolder.mutate({ id: dragData.folder.id, newParentId: targetFolderId });
      }
    },
    [activeItem, moveEntry, moveFolder]
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
          {activeItem?.type === 'entry' && <EntryDragGhost title={activeItem.entry.title} />}
          {activeItem?.type === 'folder' && <FolderDragGhost name={activeItem.folder.name} />}
        </DragOverlay>
      </DndContext>
    </DndStateContext.Provider>
  );
}
