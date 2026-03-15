import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    postSSE: vi.fn(),
  },
}));

import { testEntry, getTestRuns, getAvailableModels } from './playgroundService';
import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── testEntry ──

describe('testEntry', () => {
  it('calls POST /api/entries/{entryId}/test with params (no streaming)', async () => {
    const result = {
      runId: 'run-1',
      responses: [{ promptIndex: 0, content: 'Hello world' }],
    };
    mockApi.post.mockResolvedValue(result);

    const res = await testEntry('e-123', {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000,
      templateFields: { topic: 'AI' },
    });

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/e-123/test', {
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000,
      templateFields: { topic: 'AI' },
    });
    expect(res.runId).toBe('run-1');
    expect(res.responses).toHaveLength(1);
  });

  it('uses default temperature and maxTokens when not provided', async () => {
    mockApi.post.mockResolvedValue({ runId: 'r1', responses: [] });

    await testEntry('e-1', {});

    expect(mockApi.post).toHaveBeenCalledWith('/api/entries/e-1/test', {
      model: undefined,
      temperature: 1.0,
      maxTokens: 4096,
      templateFields: undefined,
    });
  });

  it('calls postSSE when onChunk callback is provided', async () => {
    const result = {
      runId: 'run-sse',
      responses: [{ promptIndex: 0, content: 'Streamed' }],
    };
    mockApi.postSSE.mockResolvedValue(result);

    const chunks: unknown[] = [];
    const res = await testEntry(
      'e-456',
      { model: 'gpt-4o-mini', temperature: 1.0, maxTokens: 4096 },
      (chunk) => chunks.push(chunk)
    );

    expect(mockApi.postSSE).toHaveBeenCalledWith(
      '/api/entries/e-456/test',
      expect.objectContaining({ model: 'gpt-4o-mini' }),
      expect.any(Function),
      undefined
    );
    expect(res.runId).toBe('run-sse');
  });
});

// ── getTestRuns ──

describe('getTestRuns', () => {
  it('calls GET /api/entries/{entryId}/test-runs', async () => {
    const runs = [
      {
        id: 'r-1',
        model: 'gpt-4o',
        temperature: 1.0,
        maxTokens: 4096,
        templateFieldValues: null,
        responses: [{ promptIndex: 0, content: 'Output' }],
        createdAt: '2026-03-15T10:00:00Z',
      },
    ];
    mockApi.get.mockResolvedValue(runs);

    const result = await getTestRuns('e-789');

    expect(mockApi.get).toHaveBeenCalledWith('/api/entries/e-789/test-runs');
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe('gpt-4o');
  });

  it('returns empty array when no runs exist', async () => {
    mockApi.get.mockResolvedValue([]);

    const result = await getTestRuns('e-empty');

    expect(result).toEqual([]);
  });
});

// ── getAvailableModels ──

describe('getAvailableModels', () => {
  it('calls GET /api/ai/models and returns models array', async () => {
    mockApi.get.mockResolvedValue({ models: ['gpt-4o', 'gpt-4o-mini', 'gpt-5.2'] });

    const result = await getAvailableModels();

    expect(mockApi.get).toHaveBeenCalledWith('/api/ai/models');
    expect(result).toEqual(['gpt-4o', 'gpt-4o-mini', 'gpt-5.2']);
  });

  it('returns empty array when no models available', async () => {
    mockApi.get.mockResolvedValue({ models: [] });

    const result = await getAvailableModels();

    expect(result).toEqual([]);
  });
});
