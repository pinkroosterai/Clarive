import { api } from './apiClient';

export async function favoriteEntry(entryId: string): Promise<void> {
  return api.post(`/api/entries/${entryId}/favorite`);
}

export async function unfavoriteEntry(entryId: string): Promise<void> {
  return api.delete(`/api/entries/${entryId}/favorite`);
}
