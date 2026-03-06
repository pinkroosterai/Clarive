import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
  },
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
}));

import { getApiKeysList, createApiKey, deleteApiKey } from './apiKeyService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getApiKeysList ──

describe('getApiKeysList', () => {
  it('calls GET /api/api-keys', async () => {
    mockApi.get.mockResolvedValue([]);

    await getApiKeysList();

    expect(mockApi.get).toHaveBeenCalledWith('/api/api-keys');
  });

  it('maps API response key field to keyPrefix', async () => {
    const apiItems = [
      {
        id: 'k1',
        name: 'Production Key',
        key: 'cl_abc123',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'k2',
        name: 'Dev Key',
        key: 'cl_xyz789',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];
    mockApi.get.mockResolvedValue(apiItems);

    const result = await getApiKeysList();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'k1',
      name: 'Production Key',
      keyPrefix: 'cl_abc123',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(result[1]).toEqual({
      id: 'k2',
      name: 'Dev Key',
      keyPrefix: 'cl_xyz789',
      createdAt: '2026-02-01T00:00:00Z',
    });
  });

  it('returns empty array when no keys exist', async () => {
    mockApi.get.mockResolvedValue([]);

    const result = await getApiKeysList();

    expect(result).toEqual([]);
  });
});

// ── createApiKey ──

describe('createApiKey', () => {
  it('calls POST /api/api-keys with name', async () => {
    const apiRes = {
      id: 'k-new',
      name: 'New Key',
      key: 'cl_full_key_value_here',
      prefix: 'cl_full',
      createdAt: '2026-03-01T00:00:00Z',
    };
    mockApi.post.mockResolvedValue(apiRes);

    await createApiKey('New Key');

    expect(mockApi.post).toHaveBeenCalledWith('/api/api-keys', {
      name: 'New Key',
    });
  });

  it('maps API response to ApiKey with fullKey and keyPrefix', async () => {
    const apiRes = {
      id: 'k-new',
      name: 'My Key',
      key: 'cl_abc123def456ghi789',
      prefix: 'cl_abc1',
      createdAt: '2026-03-01T00:00:00Z',
    };
    mockApi.post.mockResolvedValue(apiRes);

    const result = await createApiKey('My Key');

    expect(result).toEqual({
      id: 'k-new',
      name: 'My Key',
      keyPrefix: 'cl_abc1',
      createdAt: '2026-03-01T00:00:00Z',
      fullKey: 'cl_abc123def456ghi789',
    });
  });

  it('maps prefix (not key) to keyPrefix', async () => {
    const apiRes = {
      id: 'k1',
      name: 'Test',
      key: 'cl_the_full_secret_key',
      prefix: 'cl_the_',
      createdAt: '2026-01-01T00:00:00Z',
    };
    mockApi.post.mockResolvedValue(apiRes);

    const result = await createApiKey('Test');

    // keyPrefix comes from res.prefix, NOT res.key
    expect(result.keyPrefix).toBe('cl_the_');
    // fullKey comes from res.key
    expect(result.fullKey).toBe('cl_the_full_secret_key');
  });
});

// ── deleteApiKey ──

describe('deleteApiKey', () => {
  it('calls DELETE /api/api-keys/:id', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await deleteApiKey('k1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/api-keys/k1');
  });
});
