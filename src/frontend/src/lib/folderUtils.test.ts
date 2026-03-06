import { describe, it, expect } from "vitest";
import {
  findFolderName,
  buildFolderMap,
  buildFolderAncestorPath,
  flattenFolders,
} from "./folderUtils";
import type { Folder } from "@/types";

function makeTree(): Folder[] {
  return [
    {
      id: "f1",
      name: "Root A",
      parentId: null,
      children: [
        {
          id: "f2",
          name: "Child 1",
          parentId: "f1",
          children: [
            { id: "f4", name: "Grandchild", parentId: "f2", children: [] },
          ],
        },
        { id: "f3", name: "Child 2", parentId: "f1", children: [] },
      ],
    },
    { id: "f5", name: "Root B", parentId: null, children: [] },
  ];
}

describe("findFolderName", () => {
  const tree = makeTree();

  it("returns 'Root' for null id", () => {
    expect(findFolderName(tree, null)).toBe("Root");
  });

  it("finds a root-level folder", () => {
    expect(findFolderName(tree, "f1")).toBe("Root A");
  });

  it("finds a nested folder", () => {
    expect(findFolderName(tree, "f4")).toBe("Grandchild");
  });

  it("finds a second root-level folder", () => {
    expect(findFolderName(tree, "f5")).toBe("Root B");
  });

  it("returns 'Root' for non-existent id", () => {
    expect(findFolderName(tree, "nonexistent")).toBe("Root");
  });

  it("handles empty tree", () => {
    expect(findFolderName([], "f1")).toBe("Root");
  });
});

describe("buildFolderMap", () => {
  it("returns empty object for empty tree", () => {
    expect(buildFolderMap([])).toEqual({});
  });

  it("maps all folders in tree by id", () => {
    const map = buildFolderMap(makeTree());
    expect(map).toEqual({
      f1: "Root A",
      f2: "Child 1",
      f3: "Child 2",
      f4: "Grandchild",
      f5: "Root B",
    });
  });
});

describe("buildFolderAncestorPath", () => {
  const tree = makeTree();

  it("returns empty array for null folderId", () => {
    expect(buildFolderAncestorPath(tree, null)).toEqual([]);
  });

  it("returns single-element path for root folder", () => {
    expect(buildFolderAncestorPath(tree, "f1")).toEqual([
      { id: "f1", name: "Root A" },
    ]);
  });

  it("returns full ancestor chain for nested folder", () => {
    expect(buildFolderAncestorPath(tree, "f4")).toEqual([
      { id: "f1", name: "Root A" },
      { id: "f2", name: "Child 1" },
      { id: "f4", name: "Grandchild" },
    ]);
  });

  it("returns path for direct child", () => {
    expect(buildFolderAncestorPath(tree, "f3")).toEqual([
      { id: "f1", name: "Root A" },
      { id: "f3", name: "Child 2" },
    ]);
  });

  it("returns empty array for non-existent id", () => {
    expect(buildFolderAncestorPath(tree, "nonexistent")).toEqual([]);
  });
});

describe("flattenFolders", () => {
  it("returns empty array for empty tree", () => {
    expect(flattenFolders([])).toEqual([]);
  });

  it("flattens a tree with depth tracking", () => {
    const result = flattenFolders(makeTree());
    expect(result).toEqual([
      { id: "f1", name: "Root A", depth: 0 },
      { id: "f2", name: "Child 1", depth: 1 },
      { id: "f4", name: "Grandchild", depth: 2 },
      { id: "f3", name: "Child 2", depth: 1 },
      { id: "f5", name: "Root B", depth: 0 },
    ]);
  });

  it("handles single-node tree", () => {
    const tree: Folder[] = [{ id: "x", name: "Only", parentId: null, children: [] }];
    expect(flattenFolders(tree)).toEqual([{ id: "x", name: "Only", depth: 0 }]);
  });
});
