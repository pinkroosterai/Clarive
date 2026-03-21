import { describe, it, expect } from 'vitest';

import { getFolderColorClass, FOLDER_COLORS } from './folderColors';
import {
  findFolderName,
  buildFolderMap,
  buildFolderAncestorPath,
  flattenFolders,
  filterFolderTree,
  buildRecursiveCountMap,
  collectAllFolderIds,
} from './folderUtils';

import type { Folder } from '@/types';

function makeTree(): Folder[] {
  return [
    {
      id: 'f1',
      name: 'Root A',
      parentId: null,
      color: null,
      children: [
        {
          id: 'f2',
          name: 'Child 1',
          parentId: 'f1',
          color: null,
          children: [{ id: 'f4', name: 'Grandchild', parentId: 'f2', color: null, children: [] }],
        },
        { id: 'f3', name: 'Child 2', parentId: 'f1', color: null, children: [] },
      ],
    },
    { id: 'f5', name: 'Root B', parentId: null, color: null, children: [] },
  ];
}

describe('findFolderName', () => {
  const tree = makeTree();

  it("returns 'Root' for null id", () => {
    expect(findFolderName(tree, null)).toBe('Root');
  });

  it('finds a root-level folder', () => {
    expect(findFolderName(tree, 'f1')).toBe('Root A');
  });

  it('finds a nested folder', () => {
    expect(findFolderName(tree, 'f4')).toBe('Grandchild');
  });

  it('finds a second root-level folder', () => {
    expect(findFolderName(tree, 'f5')).toBe('Root B');
  });

  it("returns 'Root' for non-existent id", () => {
    expect(findFolderName(tree, 'nonexistent')).toBe('Root');
  });

  it('handles empty tree', () => {
    expect(findFolderName([], 'f1')).toBe('Root');
  });
});

describe('buildFolderMap', () => {
  it('returns empty object for empty tree', () => {
    expect(buildFolderMap([])).toEqual({});
  });

  it('maps all folders in tree by id', () => {
    const map = buildFolderMap(makeTree());
    expect(map).toEqual({
      f1: 'Root A',
      f2: 'Child 1',
      f3: 'Child 2',
      f4: 'Grandchild',
      f5: 'Root B',
    });
  });
});

describe('buildFolderAncestorPath', () => {
  const tree = makeTree();

  it('returns empty array for null folderId', () => {
    expect(buildFolderAncestorPath(tree, null)).toEqual([]);
  });

  it('returns single-element path for root folder', () => {
    expect(buildFolderAncestorPath(tree, 'f1')).toEqual([{ id: 'f1', name: 'Root A' }]);
  });

  it('returns full ancestor chain for nested folder', () => {
    expect(buildFolderAncestorPath(tree, 'f4')).toEqual([
      { id: 'f1', name: 'Root A' },
      { id: 'f2', name: 'Child 1' },
      { id: 'f4', name: 'Grandchild' },
    ]);
  });

  it('returns path for direct child', () => {
    expect(buildFolderAncestorPath(tree, 'f3')).toEqual([
      { id: 'f1', name: 'Root A' },
      { id: 'f3', name: 'Child 2' },
    ]);
  });

  it('returns empty array for non-existent id', () => {
    expect(buildFolderAncestorPath(tree, 'nonexistent')).toEqual([]);
  });
});

describe('flattenFolders', () => {
  it('returns empty array for empty tree', () => {
    expect(flattenFolders([])).toEqual([]);
  });

  it('flattens a tree with depth tracking', () => {
    const result = flattenFolders(makeTree());
    expect(result).toEqual([
      { id: 'f1', name: 'Root A', depth: 0 },
      { id: 'f2', name: 'Child 1', depth: 1 },
      { id: 'f4', name: 'Grandchild', depth: 2 },
      { id: 'f3', name: 'Child 2', depth: 1 },
      { id: 'f5', name: 'Root B', depth: 0 },
    ]);
  });

  it('handles single-node tree', () => {
    const tree: Folder[] = [{ id: 'x', name: 'Only', parentId: null, color: null, children: [] }];
    expect(flattenFolders(tree)).toEqual([{ id: 'x', name: 'Only', depth: 0 }]);
  });
});

describe('filterFolderTree', () => {
  it('returns original tree for empty query', () => {
    const tree = makeTree();
    expect(filterFolderTree(tree, '')).toBe(tree);
  });

  it('returns original tree for whitespace-only query', () => {
    const tree = makeTree();
    expect(filterFolderTree(tree, '   ')).toBe(tree);
  });

  it('filters by exact folder name (case-insensitive)', () => {
    const result = filterFolderTree(makeTree(), 'grandchild');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Root A');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].name).toBe('Child 1');
    expect(result[0].children[0].children).toHaveLength(1);
    expect(result[0].children[0].children[0].name).toBe('Grandchild');
  });

  it('filters by partial name match', () => {
    const result = filterFolderTree(makeTree(), 'child');
    // "Child 1", "Child 2", and "Grandchild" all match — their ancestors are preserved
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Root A');
    expect(result[0].children).toHaveLength(2);
  });

  it('preserves ancestor path for nested matches', () => {
    const result = filterFolderTree(makeTree(), 'Grand');
    // Grandchild matches → Child 1 and Root A preserved as ancestors
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].id).toBe('f2');
    expect(result[0].children[0].children).toHaveLength(1);
    expect(result[0].children[0].children[0].id).toBe('f4');
  });

  it('returns empty array when no folders match', () => {
    expect(filterFolderTree(makeTree(), 'nonexistent')).toEqual([]);
  });

  it('matches root-level folders', () => {
    const result = filterFolderTree(makeTree(), 'Root B');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Root B');
    expect(result[0].children).toEqual([]);
  });

  it('includes matching parent even if children do not match', () => {
    const result = filterFolderTree(makeTree(), 'Root A');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Root A');
    // Children are not included because they don't match
    expect(result[0].children).toEqual([]);
  });

  it('does not mutate the original tree', () => {
    const tree = makeTree();
    const originalChildren = tree[0].children.length;
    filterFolderTree(tree, 'Grandchild');
    expect(tree[0].children).toHaveLength(originalChildren);
  });

  it('handles empty tree', () => {
    expect(filterFolderTree([], 'anything')).toEqual([]);
  });
});

describe('buildRecursiveCountMap', () => {
  // Tree: Root A (f1) → Child 1 (f2) → Grandchild (f4), Child 2 (f3); Root B (f5)

  it('returns empty map for empty tree', () => {
    const result = buildRecursiveCountMap([], new Map());
    expect(result.size).toBe(0);
  });

  it('returns direct counts when no nesting', () => {
    const tree = makeTree();
    const direct = new Map<string | null, number>([
      ['f5', 3],
    ]);
    const result = buildRecursiveCountMap(tree, direct);
    expect(result.get('f5')).toBe(3);
    expect(result.get('f1')).toBe(0);
  });

  it('aggregates child counts into parent', () => {
    const tree = makeTree();
    const direct = new Map<string | null, number>([
      ['f2', 2],
      ['f3', 1],
    ]);
    const result = buildRecursiveCountMap(tree, direct);
    // f2 has 2 direct, f3 has 1 direct
    expect(result.get('f2')).toBe(2);
    expect(result.get('f3')).toBe(1);
    // f1 = 0 direct + 2 (f2) + 1 (f3) = 3
    expect(result.get('f1')).toBe(3);
  });

  it('aggregates deeply nested counts', () => {
    const tree = makeTree();
    const direct = new Map<string | null, number>([
      ['f4', 5],
    ]);
    const result = buildRecursiveCountMap(tree, direct);
    // f4 = 5, f2 = 0 + 5 (from f4) = 5, f1 = 0 + 5 (from f2) + 0 (from f3) = 5
    expect(result.get('f4')).toBe(5);
    expect(result.get('f2')).toBe(5);
    expect(result.get('f1')).toBe(5);
    expect(result.get('f5')).toBe(0);
  });

  it('combines direct and descendant counts', () => {
    const tree = makeTree();
    const direct = new Map<string | null, number>([
      ['f1', 1],
      ['f2', 2],
      ['f4', 3],
    ]);
    const result = buildRecursiveCountMap(tree, direct);
    // f4 = 3, f2 = 2 + 3 = 5, f1 = 1 + 5 + 0 = 6
    expect(result.get('f4')).toBe(3);
    expect(result.get('f2')).toBe(5);
    expect(result.get('f1')).toBe(6);
  });

  it('folders with no entries get count 0', () => {
    const tree = makeTree();
    const result = buildRecursiveCountMap(tree, new Map());
    expect(result.get('f1')).toBe(0);
    expect(result.get('f2')).toBe(0);
    expect(result.get('f3')).toBe(0);
    expect(result.get('f4')).toBe(0);
    expect(result.get('f5')).toBe(0);
  });
});

describe('collectAllFolderIds', () => {
  it('returns empty set for empty tree', () => {
    expect(collectAllFolderIds([])).toEqual(new Set());
  });

  it('collects all folder IDs from a nested tree', () => {
    const ids = collectAllFolderIds(makeTree());
    expect(ids).toEqual(new Set(['f1', 'f2', 'f3', 'f4', 'f5']));
  });

  it('collects single folder', () => {
    const tree: Folder[] = [{ id: 'x', name: 'Only', parentId: null, color: null, children: [] }];
    expect(collectAllFolderIds(tree)).toEqual(new Set(['x']));
  });
});

describe('getFolderColorClass', () => {
  it('returns undefined for null', () => {
    expect(getFolderColorClass(null)).toBeUndefined();
  });

  it('returns correct class for each preset color', () => {
    for (const c of FOLDER_COLORS) {
      expect(getFolderColorClass(c.key)).toBe(c.tw);
    }
  });

  it('returns undefined for unknown color', () => {
    expect(getFolderColorClass('neon_rainbow')).toBeUndefined();
  });

  it('has 9 preset colors', () => {
    expect(FOLDER_COLORS).toHaveLength(9);
  });
});
