import { api } from './apiClient';

import type { EntryActivityResponse } from '@/types';

export async function getEntryActivity(
  entryId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<EntryActivityResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return api.get<EntryActivityResponse>(`/api/entries/${entryId}/activity?${params}`);
}
