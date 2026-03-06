import type { PromptEntry } from "@/types";
import { api } from "./apiClient";

export async function exportEntries(
  folderIds?: string[],
  entryIds?: string[],
): Promise<Blob> {
  return api.download("/api/export", { folderIds, entryIds });
}

interface ImportApiResponse {
  importedCount: number;
  entries: Array<{
    id: string;
    title: string;
    version: number;
    versionState: string;
    isTrashed: boolean;
    folderId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

export async function importEntries(
  yamlFile: File,
): Promise<{ imported: number; entries: PromptEntry[] }> {
  const formData = new FormData();
  formData.append("file", yamlFile);

  const res = await api.upload<ImportApiResponse>("/api/import", formData);

  return {
    imported: res.importedCount,
    entries: res.entries.map((e) => ({
      id: e.id,
      title: e.title,
      systemMessage: null,
      prompts: [],
      folderId: e.folderId,
      version: e.version,
      versionState: e.versionState as PromptEntry["versionState"],
      isTrashed: e.isTrashed,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      createdBy: "",
    })),
  };
}
