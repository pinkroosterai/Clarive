import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { getAiUsageLogs, getAiUsageStats } from './aiUsageService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAiUsageLogs', () => {
  it('calls GET /api/super/ai-usage with filters and pagination', async () => {
    const response = { items: [], page: 1, pageSize: 50, totalCount: 0 };
    mockApi.get.mockResolvedValue(response);

    const result = await getAiUsageLogs({ models: ['gpt-4o'] }, 2, 25);

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/ai-usage?model=gpt-4o&page=2&pageSize=25');
    expect(result).toEqual(response);
  });

  it('joins multiple models with commas', async () => {
    mockApi.get.mockResolvedValue({ items: [], page: 1, pageSize: 50, totalCount: 0 });

    await getAiUsageLogs({ models: ['gpt-4o', 'claude-3'] });

    expect(mockApi.get).toHaveBeenCalledWith(expect.stringContaining('model=gpt-4o%2Cclaude-3'));
  });

  it('omits undefined filter params', async () => {
    mockApi.get.mockResolvedValue({ items: [], page: 1, pageSize: 50, totalCount: 0 });

    await getAiUsageLogs({});

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/ai-usage?page=1&pageSize=50');
  });

  it('includes dateFrom and dateTo', async () => {
    mockApi.get.mockResolvedValue({ items: [], page: 1, pageSize: 50, totalCount: 0 });

    await getAiUsageLogs({
      dateFrom: '2026-03-01T00:00:00Z',
      dateTo: '2026-03-16T00:00:00Z',
    });

    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining('dateFrom=2026-03-01T00%3A00%3A00Z')
    );
    expect(mockApi.get).toHaveBeenCalledWith(
      expect.stringContaining('dateTo=2026-03-16T00%3A00%3A00Z')
    );
  });
});

describe('getAiUsageStats', () => {
  it('calls GET /api/super/ai-usage/stats with filters', async () => {
    const stats = {
      totals: {
        totalRequests: 10,
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalTokens: 150,
        totalEstimatedInputCostUsd: 0.01,
        totalEstimatedOutputCostUsd: 0.02,
        totalEstimatedCostUsd: 0.03,
      },
      averages: {
        avgInputTokensPerRequest: 10,
        avgOutputTokensPerRequest: 5,
        avgTotalTokensPerRequest: 15,
      },
      byModel: [],
      byTenant: [],
      byUser: [],
      byActionType: [],
    };
    mockApi.get.mockResolvedValue(stats);

    const result = await getAiUsageStats({ actionTypes: ['Generation'] });

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/ai-usage/stats?actionType=Generation');
    expect(result).toEqual(stats);
  });

  it('calls without query string when no filters', async () => {
    mockApi.get.mockResolvedValue({
      totals: {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalEstimatedInputCostUsd: 0,
        totalEstimatedOutputCostUsd: 0,
        totalEstimatedCostUsd: 0,
      },
      averages: {
        avgInputTokensPerRequest: 0,
        avgOutputTokensPerRequest: 0,
        avgTotalTokensPerRequest: 0,
      },
      byModel: [],
      byTenant: [],
      byUser: [],
      byActionType: [],
    });

    await getAiUsageStats({});

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/ai-usage/stats');
  });
});
