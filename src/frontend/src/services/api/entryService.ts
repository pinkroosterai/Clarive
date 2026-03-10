import { api } from './apiClient';

import type { PromptEntry, PaginatedResponse, VersionInfo } from '@/types';

interface EntrySummary {
  id: string;
  title: string;
  version: number;
  versionState: 'draft' | 'published' | 'historical';
  isTrashed: boolean;
  folderId: string | null;
  hasSystemMessage: boolean;
  isTemplate: boolean;
  isChain: boolean;
  promptCount: number;
  firstPromptPreview: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isFavorited: boolean;
}

function summaryToEntry(s: EntrySummary): PromptEntry {
  return {
    id: s.id,
    title: s.title,
    systemMessage: null,
    prompts: [],
    folderId: s.folderId,
    version: s.version,
    versionState: s.versionState,
    isTrashed: s.isTrashed,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    createdBy: '',
    hasSystemMessage: s.hasSystemMessage,
    isTemplate: s.isTemplate,
    isChain: s.isChain,
    promptCount: s.promptCount,
    firstPromptPreview: s.firstPromptPreview,
    tags: s.tags,
    isFavorited: s.isFavorited,
  };
}

export async function getEntriesList(
  folderId?: string | null,
  page: number = 1,
  pageSize: number = 50,
  tags?: string[],
  tagMode?: 'and' | 'or'
): Promise<PaginatedResponse<PromptEntry>> {
  const params = new URLSearchParams();
  params.set('folderId', folderId ?? 'all');
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (tags && tags.length > 0) params.set('tags', tags.join(','));
  if (tagMode) params.set('tagMode', tagMode);
  const res = await api.get<PaginatedResponse<EntrySummary>>(`/api/entries?${params}`);
  return {
    items: res.items.map(summaryToEntry),
    totalCount: res.totalCount,
    page: res.page,
    pageSize: res.pageSize,
  };
}

export async function getEntry(id: string): Promise<PromptEntry> {
  return api.get<PromptEntry>(`/api/entries/${id}`);
}

export async function createEntry(
  data: Partial<PromptEntry> & { title: string }
): Promise<PromptEntry> {
  const body = {
    title: data.title,
    systemMessage: data.systemMessage ?? null,
    folderId: data.folderId ?? null,
    prompts: (data.prompts ?? [{ content: '' }]).map((p) => ({
      content: p.content,
    })),
  };
  return api.post<PromptEntry>('/api/entries', body);
}

export async function updateEntry(id: string, data: Partial<PromptEntry>): Promise<PromptEntry> {
  const body: Record<string, unknown> = {};
  if (data.title !== undefined) body.title = data.title;
  if (data.systemMessage !== undefined) body.systemMessage = data.systemMessage;
  if (data.prompts !== undefined)
    body.prompts = data.prompts.map((p) => ({
      content: p.content,
    }));
  return api.put<PromptEntry>(`/api/entries/${id}`, body);
}

export async function publishEntry(id: string): Promise<PromptEntry> {
  return api.post<PromptEntry>(`/api/entries/${id}/publish`);
}

export async function promoteVersion(entryId: string, version: number): Promise<PromptEntry> {
  return api.post<PromptEntry>(`/api/entries/${entryId}/versions/${version}/promote`);
}

export async function getVersion(entryId: string, version: number): Promise<PromptEntry> {
  return api.get<PromptEntry>(`/api/entries/${entryId}/versions/${version}`);
}

export async function getVersionHistory(entryId: string): Promise<VersionInfo[]> {
  return api.get<VersionInfo[]>(`/api/entries/${entryId}/versions`);
}

export async function moveEntry(id: string, folderId: string | null): Promise<PromptEntry> {
  return api.post<PromptEntry>(`/api/entries/${id}/move`, { folderId });
}

export async function trashEntry(id: string): Promise<void> {
  return api.post(`/api/entries/${id}/trash`);
}

export async function restoreEntry(id: string): Promise<PromptEntry> {
  return api.post<PromptEntry>(`/api/entries/${id}/restore`);
}

export async function permanentlyDeleteEntry(id: string): Promise<void> {
  return api.delete(`/api/entries/${id}/permanent-delete`);
}

export async function getTrashedEntries(
  page: number = 1,
  pageSize: number = 50
): Promise<PaginatedResponse<PromptEntry>> {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await api.get<PaginatedResponse<EntrySummary>>(`/api/entries/trash?${params}`);
  return {
    items: res.items.map(summaryToEntry),
    totalCount: res.totalCount,
    page: res.page,
    pageSize: res.pageSize,
  };
}
