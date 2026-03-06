import { api, setToken, setRefreshToken, setActiveWorkspaceId } from './apiClient';

import type { User, Workspace } from '@/types';

export async function switchWorkspace(
  tenantId: string
): Promise<{ token: string; refreshToken: string; user: User }> {
  const res = await api.post<{ token: string; refreshToken: string; user: User }>(
    '/api/auth/switch-workspace',
    { tenantId }
  );
  setToken(res.token);
  setRefreshToken(res.refreshToken);
  setActiveWorkspaceId(tenantId);
  return res;
}

export async function getWorkspaces(): Promise<{ workspaces: Workspace[] }> {
  return api.get<{ workspaces: Workspace[] }>('/api/workspaces');
}

export async function leaveWorkspace(tenantId: string): Promise<void> {
  await api.post<void>(`/api/workspaces/${tenantId}/leave`);
}
