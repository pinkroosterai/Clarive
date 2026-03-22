import type { Folder } from '@/types';

/** Minimal entry shape needed for drag-and-drop operations. */
export interface DraggableEntry {
  id: string;
  title: string;
  folderId: string | null;
}

// ── Drag data discriminated union ──────────────────────────────────────────
export interface EntryDragData {
  type: 'entry';
  entry: DraggableEntry;
}

export interface FolderDragData {
  type: 'folder';
  folder: Folder;
}

export type DragData = EntryDragData | FolderDragData;

// ── Droppable / Draggable ID helpers ───────────────────────────────────────
export const DROPPABLE_ROOT_ID = 'droppable:root';

export function droppableFolderId(id: string): string {
  return `droppable:folder:${id}`;
}

export function draggableEntryId(id: string, context: 'sidebar' | 'grid'): string {
  return `${context}-entry:${id}`;
}

export function draggableFolderId(id: string): string {
  return `draggable:folder:${id}`;
}

export function parseFolderIdFromDroppable(droppableId: string): string | null {
  if (droppableId === DROPPABLE_ROOT_ID) return null;
  const match = droppableId.match(/^droppable:folder:(.+)$/);
  return match ? match[1] : null;
}
