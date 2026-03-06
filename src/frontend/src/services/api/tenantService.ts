import { api } from './apiClient';

export interface Tenant {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export async function getTenant(): Promise<Tenant> {
  return api.get<Tenant>('/api/tenant');
}

export async function updateTenantName(name: string): Promise<Tenant> {
  return api.patch<Tenant>('/api/tenant', { name });
}

export async function uploadWorkspaceAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  return api.upload<{ avatarUrl: string }>('/api/tenant/avatar', formData);
}

export async function deleteWorkspaceAvatar(): Promise<void> {
  await api.delete('/api/tenant/avatar');
}
