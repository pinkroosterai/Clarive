import type { ToolDescription, McpImportResponse } from "@/types";
import { api } from "./apiClient";

export async function getToolsList(): Promise<ToolDescription[]> {
  const res = await api.get<{ items: ToolDescription[] }>("/api/tools");
  return res.items;
}

export async function createTool(
  data: Omit<ToolDescription, "id" | "inputSchema">,
): Promise<ToolDescription> {
  return api.post<ToolDescription>("/api/tools", data);
}

export async function updateTool(
  id: string,
  data: Partial<Omit<ToolDescription, "id" | "inputSchema">>,
): Promise<ToolDescription> {
  return api.patch<ToolDescription>(`/api/tools/${id}`, data);
}

export async function deleteTool(id: string): Promise<void> {
  return api.delete(`/api/tools/${id}`);
}

export async function importFromMcp(
  serverUrl: string,
  bearerToken?: string,
): Promise<McpImportResponse> {
  return api.post<McpImportResponse>("/api/tools/import-mcp", {
    serverUrl,
    bearerToken: bearerToken || undefined,
  });
}
