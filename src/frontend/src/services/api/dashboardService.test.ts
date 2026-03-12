import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { getStats } from './dashboardService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getStats', () => {
  it('calls GET /api/dashboard/stats', async () => {
    const stats = { totalEntries: 10, publishedEntries: 5 };
    mockApi.get.mockResolvedValue(stats);

    const result = await getStats();

    expect(mockApi.get).toHaveBeenCalledWith('/api/dashboard/stats');
    expect(result).toEqual(stats);
  });
});
