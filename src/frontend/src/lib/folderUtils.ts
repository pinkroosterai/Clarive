import type { Folder } from '@/types';

/** Recursively find a folder's name by ID, returning "Root" for null/missing. */
export function findFolderName(tree: Folder[], id: string | null): string {
  if (!id) return 'Root';
  for (const f of tree) {
    if (f.id === id) return f.name;
    const found = findFolderName(f.children, id);
    if (found !== 'Root') return found;
  }
  return 'Root';
}

/** Flatten a folder tree into a Record mapping id → name. */
export function buildFolderMap(folders: Folder[]): Record<string, string> {
  const map: Record<string, string> = {};
  const walk = (list: Folder[]) => {
    for (const f of list) {
      map[f.id] = f.name;
      if (f.children.length) walk(f.children);
    }
  };
  walk(folders);
  return map;
}

/** Build the ancestor chain from root to the target folder (inclusive). Returns [] for null ID. */
export function buildFolderAncestorPath(
  tree: Folder[],
  folderId: string | null
): { id: string; name: string }[] {
  if (!folderId) return [];
  const path: { id: string; name: string }[] = [];
  const find = (nodes: Folder[]): boolean => {
    for (const f of nodes) {
      path.push({ id: f.id, name: f.name });
      if (f.id === folderId) return true;
      if (find(f.children)) return true;
      path.pop();
    }
    return false;
  };
  find(tree);
  return path;
}

/**
 * Filter a folder tree by query string, keeping matching folders and their ancestor paths.
 * Returns a new tree (does not mutate the original). Empty query returns the original tree.
 */
export function filterFolderTree(tree: Folder[], query: string): Folder[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree;

  const filter = (nodes: Folder[]): Folder[] => {
    const result: Folder[] = [];
    for (const folder of nodes) {
      const filteredChildren = filter(folder.children);
      const nameMatches = folder.name.toLowerCase().includes(q);
      if (nameMatches || filteredChildren.length > 0) {
        result.push({ ...folder, children: filteredChildren });
      }
    }
    return result;
  };

  return filter(tree);
}

/**
 * Build a map of folderId → recursive entry count (direct entries + all descendant entries).
 * Post-order traversal: leaf counts stay as-is, parents sum their own + children's totals.
 */
export function buildRecursiveCountMap(
  tree: Folder[],
  directCountMap: Map<string | null, number>
): Map<string, number> {
  const result = new Map<string, number>();

  const walk = (folders: Folder[]): void => {
    for (const folder of folders) {
      walk(folder.children);
      let total = directCountMap.get(folder.id) ?? 0;
      for (const child of folder.children) {
        total += result.get(child.id) ?? 0;
      }
      result.set(folder.id, total);
    }
  };

  walk(tree);
  return result;
}

/** Collect all folder IDs from a tree into a Set (for expand-all). */
export function collectAllFolderIds(tree: Folder[]): Set<string> {
  const ids = new Set<string>();
  const walk = (folders: Folder[]) => {
    for (const f of folders) {
      ids.add(f.id);
      walk(f.children);
    }
  };
  walk(tree);
  return ids;
}

export interface FlatFolder {
  id: string;
  name: string;
  depth: number;
}

/** Flatten a folder tree into an ordered array with depth tracking (for selects/dropdowns). */
export function flattenFolders(tree: Folder[], depth = 0): FlatFolder[] {
  const result: FlatFolder[] = [];
  for (const folder of tree) {
    result.push({ id: folder.id, name: folder.name, depth });
    if (folder.children.length > 0) {
      result.push(...flattenFolders(folder.children, depth + 1));
    }
  }
  return result;
}
