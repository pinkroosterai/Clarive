import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { favoriteEntry, unfavoriteEntry } from './favoriteService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('favoriteEntry', () => {
  it('calls POST /api/entries/{entryId}/favorite', async () => {
    mockApi.post.mockResolvedValue(undefined);

    await favoriteEntry('entry-1');

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/entry-1/favorite');
  });
});

describe('unfavoriteEntry', () => {
  it('calls DELETE /api/entries/{entryId}/favorite', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await unfavoriteEntry('entry-1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/entries/entry-1/favorite');
  });
});
