import { api } from './apiClient';

import type { ApiKey } from '@/types';

export async function getApiKeysList(): Promise<ApiKey[]> {
  const items =
    await api.get<Array<{ id: string; name: string; key: string; createdAt: string; lastUsedAt: string | null; usageCount: number }>>(
      '/api/api-keys'
    );
  return items.map((k) => ({ id: k.id, name: k.name, keyPrefix: k.key, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt, usageCount: k.usageCount }));
}

export async function createApiKey(name: string): Promise<ApiKey> {
  const res = await api.post<{
    id: string;
    name: string;
    key: string;
    prefix: string;
    createdAt: string;
    lastUsedAt: string | null;
    usageCount: number;
  }>('/api/api-keys', { name });

  return {
    id: res.id,
    name: res.name,
    keyPrefix: res.prefix,
    createdAt: res.createdAt,
    lastUsedAt: res.lastUsedAt,
    usageCount: res.usageCount,
    fullKey: res.key,
  };
}

export async function deleteApiKey(id: string): Promise<void> {
  return api.delete(`/api/api-keys/${id}`);
}
