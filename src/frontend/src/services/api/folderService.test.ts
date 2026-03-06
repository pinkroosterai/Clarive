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

import {
  getFoldersTree,
  createFolder,
  renameFolder,
  moveFolder,
  deleteFolder,
} from './folderService';

import { api } from '@/services/api/apiClient';
import { createFolder as createFolderFactory, createFolderTree } from '@/test/factories';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getFoldersTree ──

describe('getFoldersTree', () => {
  it('calls GET /api/folders', async () => {
    const tree = createFolderTree();
    mockApi.get.mockResolvedValue(tree);

    const result = await getFoldersTree();

    expect(mockApi.get).toHaveBeenCalledWith('/api/folders');
    expect(result).toEqual(tree);
  });

  it('returns empty array when no folders exist', async () => {
    mockApi.get.mockResolvedValue([]);

    const result = await getFoldersTree();

    expect(result).toEqual([]);
  });
});

// ── createFolder ──

describe('createFolder', () => {
  it('calls POST /api/folders with name and null parentId', async () => {
    const folder = createFolderFactory({ name: 'New Folder' });
    mockApi.post.mockResolvedValue(folder);

    const result = await createFolder('New Folder');

    expect(mockApi.post).toHaveBeenCalledWith('/api/folders', {
      name: 'New Folder',
      parentId: null,
    });
    expect(result).toEqual(folder);
  });

  it('passes parentId when provided', async () => {
    const folder = createFolderFactory({ name: 'Child', parentId: 'p1' });
    mockApi.post.mockResolvedValue(folder);

    const result = await createFolder('Child', 'p1');

    expect(mockApi.post).toHaveBeenCalledWith('/api/folders', {
      name: 'Child',
      parentId: 'p1',
    });
    expect(result).toEqual(folder);
  });

  it('defaults null parentId when explicitly passed null', async () => {
    const folder = createFolderFactory({ name: 'Root' });
    mockApi.post.mockResolvedValue(folder);

    await createFolder('Root', null);

    expect(mockApi.post).toHaveBeenCalledWith('/api/folders', {
      name: 'Root',
      parentId: null,
    });
  });

  it('defaults null parentId when passed undefined', async () => {
    const folder = createFolderFactory({ name: 'Root' });
    mockApi.post.mockResolvedValue(folder);

    await createFolder('Root', undefined);

    expect(mockApi.post).toHaveBeenCalledWith('/api/folders', {
      name: 'Root',
      parentId: null,
    });
  });
});

// ── renameFolder ──

describe('renameFolder', () => {
  it('calls PATCH /api/folders/:id with new name', async () => {
    const folder = createFolderFactory({ id: 'f1', name: 'Renamed' });
    mockApi.patch.mockResolvedValue(folder);

    const result = await renameFolder('f1', 'Renamed');

    expect(mockApi.patch).toHaveBeenCalledWith('/api/folders/f1', {
      name: 'Renamed',
    });
    expect(result).toEqual(folder);
  });
});

// ── moveFolder ──

describe('moveFolder', () => {
  it('calls POST /api/folders/:id/move with new parentId', async () => {
    const folder = createFolderFactory({ id: 'f1', parentId: 'f2' });
    mockApi.post.mockResolvedValue(folder);

    const result = await moveFolder('f1', 'f2');

    expect(mockApi.post).toHaveBeenCalledWith('/api/folders/f1/move', {
      parentId: 'f2',
    });
    expect(result).toEqual(folder);
  });

  it('passes null to move folder to root', async () => {
    const folder = createFolderFactory({ id: 'f1', parentId: null });
    mockApi.post.mockResolvedValue(folder);

    await moveFolder('f1', null);

    expect(mockApi.post).toHaveBeenCalledWith('/api/folders/f1/move', {
      parentId: null,
    });
  });
});

// ── deleteFolder ──

describe('deleteFolder', () => {
  it('calls DELETE /api/folders/:id', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await deleteFolder('f1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/folders/f1');
  });
});
