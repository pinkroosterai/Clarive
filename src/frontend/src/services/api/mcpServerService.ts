import { api } from './apiClient';

import type { McpServer } from '@/types';

export async function list(): Promise<McpServer[]> {
  const res = await api.get<{ items: McpServer[] }>('/api/mcp-servers');
  return res.items;
}

export async function create(data: {
  name: string;
  url: string;
  bearerToken?: string;
}): Promise<McpServer> {
  return api.post<McpServer>('/api/mcp-servers', data);
}

export async function update(
  id: string,
  data: { name?: string; url?: string; bearerToken?: string; isActive?: boolean }
): Promise<McpServer> {
  return api.patch<McpServer>(`/api/mcp-servers/${id}`, data);
}

export async function remove(id: string): Promise<void> {
  return api.delete(`/api/mcp-servers/${id}`);
}

export async function sync(id: string): Promise<McpServer> {
  return api.post<McpServer>(`/api/mcp-servers/${id}/sync`, {});
}
