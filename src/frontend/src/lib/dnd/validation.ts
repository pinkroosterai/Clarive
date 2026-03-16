import type { DragData } from './types';

import type { Folder } from '@/types';

/** Collect a folder and all its descendant IDs (for circular-move prevention). */
export function collectDescendantIds(folder: Folder): Set<string> {
  const ids = new Set<string>();
  const walk = (f: Folder) => {
    ids.add(f.id);
    f.children.forEach(walk);
  };
  walk(folder);
  return ids;
}

/** Find a folder by ID in a nested tree. */
export function findFolder(tree: Folder[], id: string): Folder | null {
  for (const f of tree) {
    if (f.id === id) return f;
    const found = findFolder(f.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Validate whether a drop is allowed.
 * Returns true if the drop should trigger a move API call.
 */
export function isValidDrop(dragData: DragData, targetFolderId: string | null): boolean {
  if (dragData.type === 'entry') {
    // Same folder → no-op
    return dragData.entry.folderId !== targetFolderId;
  }

  // Folder drag
  const folder = dragData.folder;

  // Can't drop on self
  if (targetFolderId === folder.id) return false;

  // Same parent → no-op
  if (folder.parentId === targetFolderId) return false;

  // Can't drop into a descendant (circular)
  if (targetFolderId !== null) {
    const descendants = collectDescendantIds(folder);
    if (descendants.has(targetFolderId)) return false;
  }

  return true;
}
