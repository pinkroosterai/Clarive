import type { ApiKey } from "@/types";
import { api } from "./apiClient";

export async function getApiKeysList(): Promise<ApiKey[]> {
  const items = await api.get<Array<{ id: string; name: string; key: string; createdAt: string }>>("/api/api-keys");
  return items.map((k) => ({ id: k.id, name: k.name, keyPrefix: k.key, createdAt: k.createdAt }));
}

export async function createApiKey(
  name: string,
): Promise<ApiKey> {
  const res = await api.post<{
    id: string;
    name: string;
    key: string;
    prefix: string;
    createdAt: string;
  }>("/api/api-keys", { name });

  return {
    id: res.id,
    name: res.name,
    keyPrefix: res.prefix,
    createdAt: res.createdAt,
    fullKey: res.key,
  };
}

export async function deleteApiKey(id: string): Promise<void> {
  return api.delete(`/api/api-keys/${id}`);
}
