import { api } from './apiClient';

import type { ApiKey } from '@/types';

export async function getApiKeysList(): Promise<ApiKey[]> {
  const items =
    await api.get<Array<{ id: string; name: string; key: string; createdAt: string; expiresAt: string | null; lastUsedAt: string | null; usageCount: number; isExpired: boolean }>>(
      '/api/api-keys'
    );
  return items.map((k) => ({ id: k.id, name: k.name, keyPrefix: k.key, createdAt: k.createdAt, expiresAt: k.expiresAt, lastUsedAt: k.lastUsedAt, usageCount: k.usageCount, isExpired: k.isExpired }));
}

export async function createApiKey(name: string, expiresAt?: string): Promise<ApiKey> {
  const res = await api.post<{
    id: string;
    name: string;
    key: string;
    prefix: string;
    createdAt: string;
    expiresAt: string | null;
    lastUsedAt: string | null;
    usageCount: number;
  }>('/api/api-keys', { name, expiresAt: expiresAt ?? null });

  return {
    id: res.id,
    name: res.name,
    keyPrefix: res.prefix,
    createdAt: res.createdAt,
    expiresAt: res.expiresAt,
    lastUsedAt: res.lastUsedAt,
    usageCount: res.usageCount,
    isExpired: false,
    fullKey: res.key,
  };
}

export async function deleteApiKey(id: string): Promise<void> {
  return api.delete(`/api/api-keys/${id}`);
}
