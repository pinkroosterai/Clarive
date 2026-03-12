import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  getAllConfig,
  setConfigValue,
  resetConfigValue,
  validateAiConfig,
  getAiModels,
} from './configService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAllConfig', () => {
  it('calls GET /api/super/config', async () => {
    const settings = [{ key: 'ai:provider', value: 'openai' }];
    mockApi.get.mockResolvedValue(settings);

    const result = await getAllConfig();

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/config');
    expect(result).toEqual(settings);
  });
});

describe('setConfigValue', () => {
  it('calls PUT /api/super/config/{key} with value', async () => {
    const response = { key: 'ai:provider', updated: true, requiresRestart: false };
    mockApi.put.mockResolvedValue(response);

    const result = await setConfigValue('ai:provider', 'openai');

    expect(mockApi.put).toHaveBeenCalledWith('/api/super/config/ai%3Aprovider', {
      value: 'openai',
    });
    expect(result).toEqual(response);
  });
});

describe('resetConfigValue', () => {
  it('calls DELETE /api/super/config/{key}', async () => {
    const response = { key: 'ai:provider', reset: true };
    mockApi.delete.mockResolvedValue(response);

    const result = await resetConfigValue('ai:provider');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/super/config/ai%3Aprovider');
    expect(result).toEqual(response);
  });
});

describe('validateAiConfig', () => {
  it('calls POST /api/super/config/validate-ai with request body', async () => {
    const response = { valid: true };
    mockApi.post.mockResolvedValue(response);

    const result = await validateAiConfig({ apiKey: 'sk-123', endpointUrl: 'https://api.openai.com' });

    expect(mockApi.post).toHaveBeenCalledWith('/api/super/config/validate-ai', {
      apiKey: 'sk-123',
      endpointUrl: 'https://api.openai.com',
    });
    expect(result).toEqual({ valid: true });
  });
});

describe('getAiModels', () => {
  it('calls POST /api/super/config/ai-models', async () => {
    const response = { models: ['gpt-4', 'gpt-3.5-turbo'] };
    mockApi.post.mockResolvedValue(response);

    const result = await getAiModels({ apiKey: 'sk-123' });

    expect(mockApi.post).toHaveBeenCalledWith('/api/super/config/ai-models', { apiKey: 'sk-123' });
    expect(result.models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
  });

  it('sends empty object when no params provided', async () => {
    mockApi.post.mockResolvedValue({ models: [] });

    await getAiModels();

    expect(mockApi.post).toHaveBeenCalledWith('/api/super/config/ai-models', {});
  });
});
