import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    download: vi.fn(),
    upload: vi.fn(),
  },
}));

import { exportEntries, importEntries } from './importExportService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('exportEntries', () => {
  it('calls download /api/export with no filters', async () => {
    const blob = new Blob(['entries:']);
    mockApi.download.mockResolvedValue(blob);

    const result = await exportEntries();

    expect(mockApi.download).toHaveBeenCalledWith('/api/export', {
      folderIds: undefined,
      entryIds: undefined,
    });
    expect(result).toBe(blob);
  });

  it('passes folderIds filter', async () => {
    mockApi.download.mockResolvedValue(new Blob());

    await exportEntries(['folder-1', 'folder-2']);

    expect(mockApi.download).toHaveBeenCalledWith('/api/export', {
      folderIds: ['folder-1', 'folder-2'],
      entryIds: undefined,
    });
  });

  it('passes entryIds filter', async () => {
    mockApi.download.mockResolvedValue(new Blob());

    await exportEntries(undefined, ['entry-1']);

    expect(mockApi.download).toHaveBeenCalledWith('/api/export', {
      folderIds: undefined,
      entryIds: ['entry-1'],
    });
  });
});

describe('importEntries', () => {
  it('uploads file and maps response to PromptEntry shape', async () => {
    const apiResponse = {
      importedCount: 1,
      entries: [
        {
          id: 'e-1',
          title: 'Imported',
          version: 1,
          versionState: 'draft',
          isTrashed: false,
          folderId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
    };
    mockApi.upload.mockResolvedValue(apiResponse);

    const file = new File(['entries:'], 'import.yaml', { type: 'application/x-yaml' });
    const result = await importEntries(file);

    expect(mockApi.upload).toHaveBeenCalledWith('/api/import', expect.any(FormData));
    expect(result.imported).toBe(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toEqual({
      id: 'e-1',
      title: 'Imported',
      systemMessage: null,
      prompts: [],
      folderId: null,
      version: 1,
      versionState: 'draft',
      isTrashed: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      createdBy: '',
    });
  });
});
