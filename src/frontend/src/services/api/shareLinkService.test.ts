import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  createShareLink,
  getShareLink,
  revokeShareLink,
  getPublicShare,
  verifySharePassword,
} from './shareLinkService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createShareLink', () => {
  it('calls POST /api/entries/{id}/share-link with request body', async () => {
    const response = { id: '1', token: 'sl_abc', entryId: 'e1', hasPassword: false };
    mockApi.post.mockResolvedValue(response);

    const result = await createShareLink('entry-123', { password: 'secret' });

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/entry-123/share-link', {
      password: 'secret',
    });
    expect(result).toEqual(response);
  });

  it('calls with empty body when no options provided', async () => {
    mockApi.post.mockResolvedValue({});

    await createShareLink('entry-123');

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/entry-123/share-link', {});
  });
});

describe('getShareLink', () => {
  it('calls GET /api/entries/{id}/share-link', async () => {
    const response = { id: '1', entryId: 'e1', accessCount: 5 };
    mockApi.get.mockResolvedValue(response);

    const result = await getShareLink('entry-123');

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/entry-123/share-link');
    expect(result).toEqual(response);
  });
});

describe('revokeShareLink', () => {
  it('calls DELETE /api/entries/{id}/share-link', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await revokeShareLink('entry-123');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/entries/entry-123/share-link');
  });
});

describe('getPublicShare', () => {
  it('calls GET /share/{token} with encoded token', async () => {
    const response = { entryId: 'e1', title: 'Test', version: 1, prompts: [] };
    mockApi.get.mockResolvedValue(response);

    const result = await getPublicShare('sl_abc+def');

    expect(mockApi.get).toHaveBeenCalledWith('/share/sl_abc%2Bdef');
    expect(result).toEqual(response);
  });
});

describe('verifySharePassword', () => {
  it('calls POST /share/{token}/verify with password body', async () => {
    const response = { entryId: 'e1', title: 'Test', version: 1, prompts: [] };
    mockApi.post.mockResolvedValue(response);

    const result = await verifySharePassword('sl_token', 'my-password');

    expect(mockApi.post).toHaveBeenCalledWith('/share/sl_token/verify', {
      password: 'my-password',
    });
    expect(result).toEqual(response);
  });
});
