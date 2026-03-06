import type { Folder } from "@/types";
import { api } from "./apiClient";

export async function getFoldersTree(): Promise<Folder[]> {
  return api.get<Folder[]>("/api/folders");
}

export async function createFolder(
  name: string,
  parentId?: string | null,
): Promise<Folder> {
  return api.post<Folder>("/api/folders", { name, parentId: parentId ?? null });
}

export async function renameFolder(
  id: string,
  name: string,
): Promise<Folder> {
  return api.patch<Folder>(`/api/folders/${id}`, { name });
}

export async function moveFolder(
  id: string,
  newParentId: string | null,
): Promise<Folder> {
  return api.post<Folder>(`/api/folders/${id}/move`, {
    parentId: newParentId,
  });
}

export async function deleteFolder(id: string): Promise<void> {
  return api.delete(`/api/folders/${id}`);
}
