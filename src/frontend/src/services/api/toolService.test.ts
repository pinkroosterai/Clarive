import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { getToolsList, createTool, updateTool, deleteTool, importFromMcp } from './toolService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getToolsList', () => {
  it('calls GET /api/tools and extracts items', async () => {
    const tools = [{ id: 't-1', name: 'Search', description: 'Web search' }];
    mockApi.get.mockResolvedValue({ items: tools });

    const result = await getToolsList();

    expect(mockApi.get).toHaveBeenCalledWith('/api/tools');
    expect(result).toEqual(tools);
  });
});

describe('createTool', () => {
  it('calls POST /api/tools', async () => {
    const data = { name: 'Search', description: 'Web search', endpoint: '/search' };
    const created = { id: 't-1', ...data };
    mockApi.post.mockResolvedValue(created);

    const result = await createTool(data as any);

    expect(mockApi.post).toHaveBeenCalledWith('/api/tools', data);
    expect(result.id).toBe('t-1');
  });
});

describe('updateTool', () => {
  it('calls PATCH /api/tools/{id}', async () => {
    const updates = { name: 'Updated Search' };
    mockApi.patch.mockResolvedValue({ id: 't-1', name: 'Updated Search' });

    const result = await updateTool('t-1', updates as any);

    expect(mockApi.patch).toHaveBeenCalledWith('/api/tools/t-1', updates);
    expect(result.name).toBe('Updated Search');
  });
});

describe('deleteTool', () => {
  it('calls DELETE /api/tools/{id}', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await deleteTool('t-1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/tools/t-1');
  });
});

describe('importFromMcp', () => {
  it('calls POST /api/tools/import-mcp with serverUrl', async () => {
    const response = { imported: 3, tools: [] };
    mockApi.post.mockResolvedValue(response);

    const result = await importFromMcp('https://mcp.example.com');

    expect(mockApi.post).toHaveBeenCalledWith('/api/tools/import-mcp', {
      serverUrl: 'https://mcp.example.com',
      bearerToken: undefined,
    });
    expect(result).toEqual(response);
  });

  it('includes bearerToken when provided', async () => {
    mockApi.post.mockResolvedValue({ imported: 0, tools: [] });

    await importFromMcp('https://mcp.example.com', 'my-token');

    expect(mockApi.post).toHaveBeenCalledWith('/api/tools/import-mcp', {
      serverUrl: 'https://mcp.example.com',
      bearerToken: 'my-token',
    });
  });
});
