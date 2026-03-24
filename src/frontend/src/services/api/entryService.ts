import { api } from './apiClient';

import type { PromptEntry, PaginatedResponse, VersionInfo, TabInfo, EvaluationEntry } from '@/types';

interface EntrySummary {
  id: string;
  title: string;
  version: number;
  versionState: 'tab' | 'published' | 'historical';
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
  evaluationAverageScore: number | null;
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
    evaluationAverageScore: s.evaluationAverageScore,
  };
}

export interface EntryTreeItem {
  id: string;
  title: string;
  folderId: string | null;
}

export async function getEntriesTree(): Promise<EntryTreeItem[]> {
  return api.get<EntryTreeItem[]>('/api/entries/tree');
}

export async function getEntriesList(
  folderId?: string | null,
  page: number = 1,
  pageSize: number = 50,
  tags?: string[],
  tagMode?: 'and' | 'or',
  search?: string,
  status?: string,
  sortBy?: string
): Promise<PaginatedResponse<PromptEntry>> {
  const params = new URLSearchParams();
  params.set('folderId', folderId ?? 'all');
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (tags && tags.length > 0) params.set('tags', tags.join(','));
  if (tagMode) params.set('tagMode', tagMode);
  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  if (sortBy && sortBy !== 'recent') params.set('sortBy', sortBy);
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
      isTemplate: ('isTemplate' in p && p.isTemplate) || false,
    })),
  };
  return api.post<PromptEntry>('/api/entries', body);
}

export async function updateEntry(
  id: string,
  data: Partial<PromptEntry>,
  options?: { evaluation?: Record<string, EvaluationEntry> | null; tabId?: string }
): Promise<PromptEntry> {
  const body: Record<string, unknown> = {};
  if (data.title !== undefined) body.title = data.title;
  if (data.systemMessage !== undefined) body.systemMessage = data.systemMessage;
  if (data.prompts !== undefined)
    body.prompts = data.prompts.map((p) => ({
      content: p.content,
    }));
  if (options?.evaluation !== undefined) body.evaluation = options.evaluation;
  if (data.rowVersion !== undefined) body.rowVersion = data.rowVersion;
  if (options?.tabId !== undefined) body.tabId = options.tabId;
  return api.put<PromptEntry>(`/api/entries/${id}`, body);
}

export async function publishTab(entryId: string, tabId: string): Promise<PromptEntry> {
  return api.post<PromptEntry>(`/api/entries/${entryId}/tabs/${tabId}/publish`);
}

export async function restoreVersion(
  entryId: string,
  version: number,
  targetTabId?: string
): Promise<PromptEntry> {
  return api.post<PromptEntry>(
    `/api/entries/${entryId}/versions/${version}/restore`,
    targetTabId ? { targetTabId } : {}
  );
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

export async function addTags(entryId: string, tags: string[]): Promise<string[]> {
  return api.post<string[]>(`/api/entries/${entryId}/tags`, { tags });
}

// ── Tabs ──

export async function getTab(entryId: string, tabId: string): Promise<PromptEntry> {
  return api.get<PromptEntry>(`/api/entries/${entryId}/tabs/${tabId}`);
}

export async function listTabs(entryId: string): Promise<TabInfo[]> {
  return api.get<TabInfo[]>(`/api/entries/${entryId}/tabs`);
}

export async function createTab(
  entryId: string,
  name: string,
  forkedFromVersion: number
): Promise<TabInfo> {
  return api.post<TabInfo>(`/api/entries/${entryId}/tabs`, { name, forkedFromVersion });
}

export async function renameTab(
  entryId: string,
  tabId: string,
  newName: string
): Promise<TabInfo> {
  return api.patch<TabInfo>(`/api/entries/${entryId}/tabs/${tabId}`, { newName });
}

export async function deleteTab(entryId: string, tabId: string): Promise<void> {
  return api.delete(`/api/entries/${entryId}/tabs/${tabId}`);
}
