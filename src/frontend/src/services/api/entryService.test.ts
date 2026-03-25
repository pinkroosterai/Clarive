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
  getEntriesList,
  getEntry,
  createEntry,
  updateEntry,
  publishTab,
  restoreVersion,
  getVersion,
  getVersionHistory,
  moveEntry,
  trashEntry,
  restoreEntry,
  permanentlyDeleteEntry,
  getTrashedEntries,
} from './entryService';

import { api } from '@/services/api/apiClient';
import { createEntry as createEntryFactory, createVersionInfo } from '@/test/factories';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getEntriesList ──

describe('getEntriesList', () => {
  it('calls GET /api/entries with default params', async () => {
    const apiSummary = {
      id: 'e1',
      title: 'My Entry',
      version: 1,
      versionState: 'tab' as const,
      isTrashed: false,
      folderId: null,
      hasSystemMessage: false,
      isTemplate: false,
      isChain: false,
      promptCount: 1,
      firstPromptPreview: 'Hello',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    mockApi.get.mockResolvedValue({
      items: [apiSummary],
      totalCount: 1,
      page: 1,
      pageSize: 50,
    });

    const result = await getEntriesList();

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries?folderId=all&page=1&pageSize=50');
    expect(result.totalCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
    expect(result.items).toHaveLength(1);
  });

  it('passes folderId when provided', async () => {
    mockApi.get.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 });

    await getEntriesList('folder-123', 2, 25);

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries?folderId=folder-123&page=2&pageSize=25');
  });

  it("defaults folderId to 'all' when null", async () => {
    mockApi.get.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 });

    await getEntriesList(null);

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries?folderId=all&page=1&pageSize=50');
  });

  it('maps EntrySummary to PromptEntry with correct defaults', async () => {
    const apiSummary = {
      id: 'e2',
      title: 'Summary Entry',
      version: 3,
      versionState: 'published' as const,
      isTrashed: false,
      folderId: 'f1',
      hasSystemMessage: true,
      isTemplate: true,
      isChain: false,
      promptCount: 2,
      firstPromptPreview: 'Preview text',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-02T00:00:00Z',
    };
    mockApi.get.mockResolvedValue({
      items: [apiSummary],
      totalCount: 1,
      page: 1,
      pageSize: 50,
    });

    const result = await getEntriesList();
    const entry = result.items[0];

    expect(entry.id).toBe('e2');
    expect(entry.title).toBe('Summary Entry');
    expect(entry.version).toBe(3);
    expect(entry.versionState).toBe('published');
    expect(entry.folderId).toBe('f1');
    expect(entry.hasSystemMessage).toBe(true);
    expect(entry.isTemplate).toBe(true);
    expect(entry.isChain).toBe(false);
    expect(entry.promptCount).toBe(2);
    expect(entry.firstPromptPreview).toBe('Preview text');
    // Default values from summaryToEntry
    expect(entry.systemMessage).toBeNull();
    expect(entry.prompts).toEqual([]);
    expect(entry.createdBy).toBe('');
  });
});

// ── getEntry ──

describe('getEntry', () => {
  it('calls GET /api/entries/:id', async () => {
    const entry = createEntryFactory({ id: 'e1' });
    mockApi.get.mockResolvedValue(entry);

    const result = await getEntry('e1');

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/e1');
    expect(result).toEqual(entry);
  });
});

// ── createEntry ──

describe('createEntry', () => {
  it('calls POST /api/entries with formatted body', async () => {
    const entry = createEntryFactory();
    mockApi.post.mockResolvedValue(entry);

    const result = await createEntry({
      title: 'New Entry',
      systemMessage: 'Be helpful',
      folderId: 'f1',
      prompts: [{ id: 'p1', content: 'Hello', order: 0 }],
    });

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries', {
      title: 'New Entry',
      systemMessage: 'Be helpful',
      folderId: 'f1',
      prompts: [{ content: 'Hello', isTemplate: false }],
    });
    expect(result).toEqual(entry);
  });

  it('defaults systemMessage to null and folderId to null', async () => {
    const entry = createEntryFactory();
    mockApi.post.mockResolvedValue(entry);

    await createEntry({ title: 'Minimal' });

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries', {
      title: 'Minimal',
      systemMessage: null,
      folderId: null,
      prompts: [{ content: '', isTemplate: false }],
    });
  });

  it('strips prompt id and order fields from body', async () => {
    const entry = createEntryFactory();
    mockApi.post.mockResolvedValue(entry);

    await createEntry({
      title: 'Test',
      prompts: [
        { id: 'p1', content: 'First', order: 0 },
        { id: 'p2', content: 'Second', order: 1 },
      ],
    });

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries', {
      title: 'Test',
      systemMessage: null,
      folderId: null,
      prompts: [{ content: 'First', isTemplate: false }, { content: 'Second', isTemplate: false }],
    });
  });
});

// ── updateEntry ──

describe('updateEntry', () => {
  it('calls PUT /api/entries/:id with only defined fields', async () => {
    const entry = createEntryFactory({ id: 'e1' });
    mockApi.put.mockResolvedValue(entry);

    await updateEntry('e1', { title: 'Updated Title' });

    expect(mockApi.put).toHaveBeenCalledWith('/api/entries/e1', {
      title: 'Updated Title',
    });
  });

  it('includes systemMessage when explicitly set', async () => {
    const entry = createEntryFactory({ id: 'e1' });
    mockApi.put.mockResolvedValue(entry);

    await updateEntry('e1', { systemMessage: 'New system msg' });

    expect(mockApi.put).toHaveBeenCalledWith('/api/entries/e1', {
      systemMessage: 'New system msg',
    });
  });

  it('maps prompts to content-only when included', async () => {
    const entry = createEntryFactory({ id: 'e1' });
    mockApi.put.mockResolvedValue(entry);

    await updateEntry('e1', {
      prompts: [{ id: 'p1', content: 'Updated content', order: 0 }],
    });

    expect(mockApi.put).toHaveBeenCalledWith('/api/entries/e1', {
      prompts: [{ content: 'Updated content' }],
    });
  });

  it('sends empty body when no fields are defined', async () => {
    const entry = createEntryFactory({ id: 'e1' });
    mockApi.put.mockResolvedValue(entry);

    await updateEntry('e1', {});

    expect(mockApi.put).toHaveBeenCalledWith('/api/entries/e1', {});
  });
});

// ── publishTab ──

describe('publishTab', () => {
  it('calls POST /api/entries/:entryId/tabs/:tabId/publish', async () => {
    const entry = createEntryFactory({ id: 'e1', versionState: 'published' });
    mockApi.post.mockResolvedValue(entry);

    const result = await publishTab('e1', 'tab-1');

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/e1/tabs/tab-1/publish');
    expect(result).toEqual(entry);
  });
});

// ── restoreVersion ──

describe('restoreVersion', () => {
  it('calls POST /api/entries/:entryId/versions/:version/restore', async () => {
    const entry = createEntryFactory({ id: 'e1' });
    mockApi.post.mockResolvedValue(entry);

    const result = await restoreVersion('e1', 2);

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/e1/versions/2/restore', {});
    expect(result).toEqual(entry);
  });
});

// ── getVersion ──

describe('getVersion', () => {
  it('calls GET /api/entries/:entryId/versions/:version', async () => {
    const entry = createEntryFactory({ id: 'e1', version: 3 });
    mockApi.get.mockResolvedValue(entry);

    const result = await getVersion('e1', 3);

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/e1/versions/3');
    expect(result).toEqual(entry);
  });
});

// ── getVersionHistory ──

describe('getVersionHistory', () => {
  it('calls GET /api/entries/:entryId/versions', async () => {
    const versions = [
      createVersionInfo({ version: 1, versionState: 'historical' }),
      createVersionInfo({ version: 2, versionState: 'published' }),
      createVersionInfo({ version: 3, versionState: 'tab' }),
    ];
    mockApi.get.mockResolvedValue(versions);

    const result = await getVersionHistory('e1');

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/e1/versions');
    expect(result).toEqual(versions);
    expect(result).toHaveLength(3);
  });
});

// ── moveEntry ──

describe('moveEntry', () => {
  it('calls POST /api/entries/:id/move with folderId', async () => {
    const entry = createEntryFactory({ id: 'e1', folderId: 'f2' });
    mockApi.post.mockResolvedValue(entry);

    const result = await moveEntry('e1', 'f2');

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/e1/move', {
      folderId: 'f2',
    });
    expect(result).toEqual(entry);
  });

  it('passes null folderId to move to root', async () => {
    const entry = createEntryFactory({ id: 'e1', folderId: null });
    mockApi.post.mockResolvedValue(entry);

    await moveEntry('e1', null);

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/e1/move', {
      folderId: null,
    });
  });
});

// ── trashEntry ──

describe('trashEntry', () => {
  it('calls POST /api/entries/:id/trash', async () => {
    mockApi.post.mockResolvedValue(undefined);

    await trashEntry('e1');

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/e1/trash');
  });
});

// ── restoreEntry ──

describe('restoreEntry', () => {
  it('calls POST /api/entries/:id/restore', async () => {
    const entry = createEntryFactory({ id: 'e1', isTrashed: false });
    mockApi.post.mockResolvedValue(entry);

    const result = await restoreEntry('e1');

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/e1/restore');
    expect(result).toEqual(entry);
  });
});

// ── permanentlyDeleteEntry ──

describe('permanentlyDeleteEntry', () => {
  it('calls DELETE /api/entries/:id/permanent-delete', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await permanentlyDeleteEntry('e1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/entries/e1/permanent-delete');
  });
});

// ── getTrashedEntries ──

describe('getTrashedEntries', () => {
  it('calls GET /api/entries/trash with default params', async () => {
    const apiSummary = {
      id: 'e1',
      title: 'Trashed',
      version: 1,
      versionState: 'tab' as const,
      isTrashed: true,
      folderId: null,
      hasSystemMessage: false,
      isTemplate: false,
      isChain: false,
      promptCount: 1,
      firstPromptPreview: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    mockApi.get.mockResolvedValue({
      items: [apiSummary],
      totalCount: 1,
      page: 1,
      pageSize: 50,
    });

    const result = await getTrashedEntries();

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/trash?page=1&pageSize=50');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].isTrashed).toBe(true);
  });

  it('passes custom page and pageSize', async () => {
    mockApi.get.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 3,
      pageSize: 10,
    });

    await getTrashedEntries(3, 10);

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/trash?page=3&pageSize=10');
  });

  it('maps EntrySummary items through summaryToEntry', async () => {
    const apiSummary = {
      id: 'e-trash',
      title: 'Trashed Entry',
      version: 2,
      versionState: 'tab' as const,
      isTrashed: true,
      folderId: 'f1',
      hasSystemMessage: true,
      isTemplate: false,
      isChain: true,
      promptCount: 3,
      firstPromptPreview: 'First prompt',
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-01-16T00:00:00Z',
    };
    mockApi.get.mockResolvedValue({
      items: [apiSummary],
      totalCount: 1,
      page: 1,
      pageSize: 50,
    });

    const result = await getTrashedEntries();
    const entry = result.items[0];

    // Mapped defaults
    expect(entry.systemMessage).toBeNull();
    expect(entry.prompts).toEqual([]);
    expect(entry.createdBy).toBe('');
    // Preserved fields
    expect(entry.hasSystemMessage).toBe(true);
    expect(entry.isChain).toBe(true);
    expect(entry.promptCount).toBe(3);
  });
});
