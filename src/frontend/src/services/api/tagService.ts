import { api } from './apiClient';

import type { TagSummary } from '@/types';

export async function getAllTags(): Promise<TagSummary[]> {
  return api.get<TagSummary[]>('/api/tags');
}

export async function renameTag(tagName: string, newName: string): Promise<void> {
  return api.put(`/api/tags/${encodeURIComponent(tagName)}`, { newName });
}

export async function deleteTag(tagName: string): Promise<void> {
  return api.delete(`/api/tags/${encodeURIComponent(tagName)}`);
}

export async function getEntryTags(entryId: string): Promise<string[]> {
  return api.get<string[]>(`/api/entries/${entryId}/tags`);
}

export async function addTags(entryId: string, tags: string[]): Promise<string[]> {
  return api.post<string[]>(`/api/entries/${entryId}/tags`, { tags });
}

export async function removeTag(entryId: string, tagName: string): Promise<void> {
  return api.delete(`/api/entries/${entryId}/tags/${encodeURIComponent(tagName)}`);
}
