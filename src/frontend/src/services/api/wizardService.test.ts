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
  generatePrompt,
  refinePrompt,
  enhanceEntry,
  generateSystemMessage,
  decomposeToChain,
} from './wizardService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Shared API response fixtures ──

function makeApiDraft(overrides?: Record<string, unknown>) {
  return {
    title: 'Generated Prompt',
    systemMessage: 'You are a helpful assistant.',
    folderId: null,
    prompts: [{ content: 'Write a poem about {{topic|string}}', isTemplate: true }],
    ...overrides,
  };
}

function makeApiEvaluation() {
  return {
    dimensions: {
      clarity: { score: 8, feedback: 'Clear' },
      specificity: { score: 7, feedback: 'Specific' },
      structure: { score: 9, feedback: 'Well structured' },
      completeness: { score: 6, feedback: 'Needs more' },
      autonomy: { score: 8, feedback: 'Good' },
      faithfulness: { score: 9, feedback: 'Faithful' },
    },
  };
}

function makeApiIterationScore() {
  return {
    iteration: 1,
    scores: {
      clarity: { score: 8, feedback: 'Clear' },
    },
    averageScore: 8,
  };
}

function makeGenerateApiResponse(overrides?: Record<string, unknown>) {
  return {
    sessionId: 'session-123',
    draft: makeApiDraft(),
    questions: [{ text: 'What tone?', suggestions: ['Formal', 'Casual'] }],
    enhancements: ['Add examples', 'Be more specific'],
    evaluation: makeApiEvaluation(),
    scoreHistory: [makeApiIterationScore()],
    ...overrides,
  };
}

// ── generatePrompt ──

describe('generatePrompt', () => {
  it('calls POST /api/ai/generate with description and default options', async () => {
    const apiRes = makeGenerateApiResponse();
    mockApi.post.mockResolvedValue(apiRes);

    const result = await generatePrompt('Create a haiku generator');

    expect(mockApi.post).toHaveBeenCalledWith('/api/ai/generate', {
      description: 'Create a haiku generator',
      generateSystemMessage: false,
      generateTemplate: false,
      generateChain: false,
      toolIds: undefined,
      enableWebSearch: false,
    });
    expect(result.sessionId).toBe('session-123');
  });

  it('passes all options when provided', async () => {
    const apiRes = makeGenerateApiResponse();
    mockApi.post.mockResolvedValue(apiRes);

    await generatePrompt('A prompt', {
      generateSystemMessage: true,
      generateTemplate: true,
      generateChain: true,
      toolIds: ['t1'],
      enableWebSearch: true,
    });

    expect(mockApi.post).toHaveBeenCalledWith('/api/ai/generate', {
      description: 'A prompt',
      generateSystemMessage: true,
      generateTemplate: true,
      generateChain: true,
      toolIds: ['t1'],
      enableWebSearch: true,
    });
  });

  it('maps apiDraft to PromptEntry with correct structure', async () => {
    const apiRes = makeGenerateApiResponse({
      draft: makeApiDraft({
        title: 'Mapped Entry',
        systemMessage: 'sys msg',
        folderId: 'f1',
        prompts: [
          { content: 'First prompt', isTemplate: false },
          { content: 'Second {{var|string}}', isTemplate: true },
        ],
      }),
    });
    mockApi.post.mockResolvedValue(apiRes);

    const result = await generatePrompt('test');
    const draft = result.draft;

    expect(draft.id).toBe('');
    expect(draft.title).toBe('Mapped Entry');
    expect(draft.systemMessage).toBe('sys msg');
    expect(draft.folderId).toBe('f1');
    expect(draft.version).toBe(1);
    expect(draft.versionState).toBe('tab');
    expect(draft.isTrashed).toBe(false);
    expect(draft.createdBy).toBe('');
    expect(draft.prompts).toHaveLength(2);
    expect(draft.prompts[0]).toEqual({
      id: 'draft-0',
      content: 'First prompt',
      order: 0,
    });
    expect(draft.prompts[1]).toEqual({
      id: 'draft-1',
      content: 'Second {{var|string}}',
      order: 1,
    });
  });

  it('sets isTemplate to true when any prompt has isTemplate', async () => {
    const apiRes = makeGenerateApiResponse({
      draft: makeApiDraft({
        prompts: [
          { content: 'plain', isTemplate: false },
          { content: '{{x}}', isTemplate: true },
        ],
      }),
    });
    mockApi.post.mockResolvedValue(apiRes);

    const result = await generatePrompt('test');

    expect(result.draft.isTemplate).toBe(true);
  });

  it('sets isTemplate to false when no prompt has isTemplate', async () => {
    const apiRes = makeGenerateApiResponse({
      draft: makeApiDraft({
        prompts: [{ content: 'plain', isTemplate: false }],
      }),
    });
    mockApi.post.mockResolvedValue(apiRes);

    const result = await generatePrompt('test');

    expect(result.draft.isTemplate).toBe(false);
  });

  it('sets isChain to true when multiple prompts exist', async () => {
    const apiRes = makeGenerateApiResponse({
      draft: makeApiDraft({
        prompts: [{ content: 'Step 1' }, { content: 'Step 2' }],
      }),
    });
    mockApi.post.mockResolvedValue(apiRes);

    const result = await generatePrompt('test');

    expect(result.draft.isChain).toBe(true);
  });

  it('sets isChain to false when single prompt exists', async () => {
    const apiRes = makeGenerateApiResponse({
      draft: makeApiDraft({
        prompts: [{ content: 'Single' }],
      }),
    });
    mockApi.post.mockResolvedValue(apiRes);

    const result = await generatePrompt('test');

    expect(result.draft.isChain).toBe(false);
  });

  it('passes through evaluation and scoreHistory', async () => {
    const apiRes = makeGenerateApiResponse();
    mockApi.post.mockResolvedValue(apiRes);

    const result = await generatePrompt('test');

    expect(result.evaluation).toEqual(makeApiEvaluation());
    expect(result.scoreHistory).toEqual([makeApiIterationScore()]);
  });

  it('handles missing evaluation and scoreHistory', async () => {
    const apiRes = makeGenerateApiResponse({
      evaluation: undefined,
      scoreHistory: undefined,
    });
    mockApi.post.mockResolvedValue(apiRes);

    const result = await generatePrompt('test');

    expect(result.evaluation).toBeUndefined();
    expect(result.scoreHistory).toBeUndefined();
  });

  it('sets createdAt and updatedAt to ISO date strings', async () => {
    const apiRes = makeGenerateApiResponse();
    mockApi.post.mockResolvedValue(apiRes);

    const result = await generatePrompt('test');

    // Should be valid ISO date strings
    expect(() => new Date(result.draft.createdAt)).not.toThrow();
    expect(() => new Date(result.draft.updatedAt)).not.toThrow();
    expect(result.draft.createdAt).toBe(result.draft.updatedAt);
  });
});

// ── refinePrompt ──

describe('refinePrompt', () => {
  it('calls POST /api/ai/refine with sessionId, answers, and selectedEnhancements', async () => {
    const apiRes = makeGenerateApiResponse({ sessionId: 's-refine' });
    mockApi.post.mockResolvedValue(apiRes);

    const answers = [{ questionIndex: 0, answer: 'Formal tone' }];
    const enhancements = [1, 3];

    const result = await refinePrompt('s-refine', answers, enhancements);

    expect(mockApi.post).toHaveBeenCalledWith('/api/ai/refine', {
      sessionId: 's-refine',
      answers,
      selectedEnhancements: enhancements,
    });
    expect(result.sessionId).toBe('s-refine');
  });

  it('handles undefined answers and enhancements', async () => {
    const apiRes = makeGenerateApiResponse();
    mockApi.post.mockResolvedValue(apiRes);

    await refinePrompt('s1');

    expect(mockApi.post).toHaveBeenCalledWith('/api/ai/refine', {
      sessionId: 's1',
      answers: undefined,
      selectedEnhancements: undefined,
    });
  });

  it('maps the response through toWizardResult', async () => {
    const apiRes = makeGenerateApiResponse();
    mockApi.post.mockResolvedValue(apiRes);

    const result = await refinePrompt('s1');

    expect(result.draft.id).toBe('');
    expect(result.draft.version).toBe(1);
    expect(result.draft.versionState).toBe('tab');
    expect(result.questions).toEqual(apiRes.questions);
    expect(result.enhancements).toEqual(apiRes.enhancements);
  });
});

// ── enhanceEntry ──

describe('enhanceEntry', () => {
  it('calls POST /api/ai/enhance with entryId', async () => {
    const apiRes = makeGenerateApiResponse({ sessionId: 's-enhance' });
    mockApi.post.mockResolvedValue(apiRes);

    const result = await enhanceEntry('entry-42');

    expect(mockApi.post).toHaveBeenCalledWith('/api/ai/enhance', {
      entryId: 'entry-42',
    });
    expect(result.sessionId).toBe('s-enhance');
  });

  it('maps the response through toWizardResult', async () => {
    const apiRes = makeGenerateApiResponse();
    mockApi.post.mockResolvedValue(apiRes);

    const result = await enhanceEntry('entry-1');

    expect(result.draft.prompts).toHaveLength(1);
    expect(result.draft.prompts[0].id).toBe('draft-0');
    expect(result.evaluation).toBeDefined();
  });
});

// ── generateSystemMessage ──

describe('generateSystemMessage', () => {
  it('calls POST /api/ai/generate-system-message with entryId', async () => {
    mockApi.post.mockResolvedValue({
      systemMessage: 'You are an expert coding assistant.',
    });

    const result = await generateSystemMessage('entry-99');

    expect(mockApi.post).toHaveBeenCalledWith('/api/ai/generate-system-message', {
      entryId: 'entry-99',
    }, undefined);
    expect(result).toBe('You are an expert coding assistant.');
  });

  it('returns only the systemMessage string from response', async () => {
    mockApi.post.mockResolvedValue({
      systemMessage: 'Be concise.',
      extraField: 'ignored',
    });

    const result = await generateSystemMessage('e1');

    expect(result).toBe('Be concise.');
    expect(typeof result).toBe('string');
  });
});

// ── decomposeToChain ──

describe('decomposeToChain', () => {
  it('calls POST /api/ai/decompose with entryId', async () => {
    mockApi.post.mockResolvedValue({
      prompts: [
        { content: 'Step 1: Analyze' },
        { content: 'Step 2: Generate' },
        { content: 'Step 3: Review' },
      ],
    });

    const result = await decomposeToChain('entry-77');

    expect(mockApi.post).toHaveBeenCalledWith('/api/ai/decompose', {
      entryId: 'entry-77',
    }, undefined);
    expect(result).toHaveLength(3);
  });

  it('maps API prompts to Prompt[] with generated ids and order', async () => {
    mockApi.post.mockResolvedValue({
      prompts: [{ content: 'First' }, { content: 'Second' }],
    });

    const result = await decomposeToChain('e1');

    expect(result[0]).toEqual({
      id: 'decomposed-0',
      content: 'First',
      order: 0,
    });
    expect(result[1]).toEqual({
      id: 'decomposed-1',
      content: 'Second',
      order: 1,
    });
  });

  it('returns empty array when API returns no prompts', async () => {
    mockApi.post.mockResolvedValue({ prompts: [] });

    const result = await decomposeToChain('e1');

    expect(result).toEqual([]);
  });
});
