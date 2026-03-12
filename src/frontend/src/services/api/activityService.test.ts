import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { getEntryActivity } from './activityService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getEntryActivity', () => {
  it('calls GET /api/entries/{entryId}/activity with default pagination', async () => {
    const response = { items: [], total: 0 };
    mockApi.get.mockResolvedValue(response);

    const result = await getEntryActivity('entry-1');

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/entry-1/activity?page=1&pageSize=20');
    expect(result).toEqual(response);
  });

  it('passes custom page and pageSize', async () => {
    mockApi.get.mockResolvedValue({ items: [], total: 0 });

    await getEntryActivity('entry-1', 3, 10);

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/entry-1/activity?page=3&pageSize=10');
  });
});
