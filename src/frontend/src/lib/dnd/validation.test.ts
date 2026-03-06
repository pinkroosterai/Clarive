import { describe, it, expect } from "vitest";
import { collectDescendantIds, findFolder, isValidDrop } from "./validation";
import type { Folder } from "@/types";
import type { DragData } from "./types";
import { createEntry } from "@/test/factories";

function makeTree(): Folder[] {
  return [
    {
      id: "f1",
      name: "Root",
      parentId: null,
      children: [
        {
          id: "f2",
          name: "Child",
          parentId: "f1",
          children: [
            { id: "f3", name: "Grandchild", parentId: "f2", children: [] },
          ],
        },
        { id: "f4", name: "Sibling", parentId: "f1", children: [] },
      ],
    },
  ];
}

describe("collectDescendantIds", () => {
  it("collects the folder itself and all descendants", () => {
    const tree = makeTree();
    const root = tree[0];
    const ids = collectDescendantIds(root);
    expect(ids).toEqual(new Set(["f1", "f2", "f3", "f4"]));
  });

  it("returns single id for leaf folder", () => {
    const leaf: Folder = { id: "leaf", name: "Leaf", parentId: "x", children: [] };
    expect(collectDescendantIds(leaf)).toEqual(new Set(["leaf"]));
  });
});

describe("findFolder", () => {
  const tree = makeTree();

  it("finds a root folder", () => {
    expect(findFolder(tree, "f1")?.name).toBe("Root");
  });

  it("finds a deeply nested folder", () => {
    expect(findFolder(tree, "f3")?.name).toBe("Grandchild");
  });

  it("returns null for non-existent id", () => {
    expect(findFolder(tree, "nonexistent")).toBeNull();
  });

  it("returns null for empty tree", () => {
    expect(findFolder([], "f1")).toBeNull();
  });
});

describe("isValidDrop", () => {
  const tree = makeTree();

  describe("entry drops", () => {
    it("allows moving entry to a different folder", () => {
      const drag: DragData = {
        type: "entry",
        entry: createEntry({ folderId: "f1" }),
      };
      expect(isValidDrop(drag, "f2", tree)).toBe(true);
    });

    it("rejects moving entry to same folder", () => {
      const drag: DragData = {
        type: "entry",
        entry: createEntry({ folderId: "f1" }),
      };
      expect(isValidDrop(drag, "f1", tree)).toBe(false);
    });

    it("allows moving entry to root (null)", () => {
      const drag: DragData = {
        type: "entry",
        entry: createEntry({ folderId: "f1" }),
      };
      expect(isValidDrop(drag, null, tree)).toBe(true);
    });

    it("rejects moving root entry back to root", () => {
      const drag: DragData = {
        type: "entry",
        entry: createEntry({ folderId: null }),
      };
      expect(isValidDrop(drag, null, tree)).toBe(false);
    });
  });

  describe("folder drops", () => {
    it("allows moving folder to a different parent", () => {
      const drag: DragData = {
        type: "folder",
        folder: tree[0].children[1], // f4 (parent: f1)
      };
      expect(isValidDrop(drag, "f2", tree)).toBe(true);
    });

    it("rejects dropping folder on itself", () => {
      const drag: DragData = { type: "folder", folder: tree[0].children[0] };
      expect(isValidDrop(drag, "f2", tree)).toBe(false);
    });

    it("rejects dropping folder on same parent", () => {
      const drag: DragData = {
        type: "folder",
        folder: tree[0].children[0], // f2 (parent: f1)
      };
      expect(isValidDrop(drag, "f1", tree)).toBe(false);
    });

    it("rejects dropping folder into its own descendant (circular)", () => {
      const drag: DragData = { type: "folder", folder: tree[0] }; // f1
      expect(isValidDrop(drag, "f3", tree)).toBe(false);
    });

    it("allows moving folder to root", () => {
      const drag: DragData = {
        type: "folder",
        folder: tree[0].children[0], // f2 (parent: f1)
      };
      expect(isValidDrop(drag, null, tree)).toBe(true);
    });
  });
});
