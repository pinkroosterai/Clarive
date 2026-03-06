import { describe, it, expect } from "vitest";
import {
  DROPPABLE_ROOT_ID,
  droppableFolderId,
  draggableEntryId,
  draggableFolderId,
  parseFolderIdFromDroppable,
} from "./types";

describe("dnd ID helpers", () => {
  it("creates droppable folder IDs", () => {
    expect(droppableFolderId("abc")).toBe("droppable:folder:abc");
  });

  it("creates draggable entry IDs with context", () => {
    expect(draggableEntryId("abc", "sidebar")).toBe("sidebar-entry:abc");
    expect(draggableEntryId("abc", "grid")).toBe("grid-entry:abc");
  });

  it("creates draggable folder IDs", () => {
    expect(draggableFolderId("abc")).toBe("draggable:folder:abc");
  });
});

describe("parseFolderIdFromDroppable", () => {
  it("returns null for root droppable", () => {
    expect(parseFolderIdFromDroppable(DROPPABLE_ROOT_ID)).toBeNull();
  });

  it("extracts folder id from droppable id", () => {
    expect(parseFolderIdFromDroppable("droppable:folder:abc-123")).toBe("abc-123");
  });

  it("returns null for unrecognized format", () => {
    expect(parseFolderIdFromDroppable("something:else")).toBeNull();
  });
});
