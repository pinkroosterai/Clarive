import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getAllTags, renameTag, deleteTag, getEntryTags, addTags, removeTag } from './tagService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAllTags', () => {
  it('calls GET /api/tags', async () => {
    const tags = [{ name: 'test', count: 3 }];
    mockApi.get.mockResolvedValue(tags);

    const result = await getAllTags();

    expect(mockApi.get).toHaveBeenCalledWith('/api/tags');
    expect(result).toEqual(tags);
  });
});

describe('renameTag', () => {
  it('calls PUT /api/tags/{tagName} with newName', async () => {
    mockApi.put.mockResolvedValue(undefined);

    await renameTag('old-tag', 'new-tag');

    expect(mockApi.put).toHaveBeenCalledWith('/api/tags/old-tag', { newName: 'new-tag' });
  });

  it('encodes special characters in tag name', async () => {
    mockApi.put.mockResolvedValue(undefined);

    await renameTag('tag/with spaces', 'new-tag');

    expect(mockApi.put).toHaveBeenCalledWith('/api/tags/tag%2Fwith%20spaces', {
      newName: 'new-tag',
    });
  });
});

describe('deleteTag', () => {
  it('calls DELETE /api/tags/{tagName}', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await deleteTag('old-tag');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/tags/old-tag');
  });
});

describe('getEntryTags', () => {
  it('calls GET /api/entries/{entryId}/tags', async () => {
    const tags = ['tag1', 'tag2'];
    mockApi.get.mockResolvedValue(tags);

    const result = await getEntryTags('entry-1');

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/entry-1/tags');
    expect(result).toEqual(['tag1', 'tag2']);
  });
});

describe('addTags', () => {
  it('calls POST /api/entries/{entryId}/tags with tags array', async () => {
    const tags = ['tag1', 'tag2'];
    mockApi.post.mockResolvedValue(tags);

    const result = await addTags('entry-1', ['tag1', 'tag2']);

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/entry-1/tags', {
      tags: ['tag1', 'tag2'],
    });
    expect(result).toEqual(tags);
  });
});

describe('removeTag', () => {
  it('calls DELETE /api/entries/{entryId}/tags/{tagName}', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await removeTag('entry-1', 'tag1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/entries/entry-1/tags/tag1');
  });
});
