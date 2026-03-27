import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { TemplateField } from '@/types';
import type { MatrixState } from '@/types/matrix';

import type { VersionContent } from './useReportData';
import { useReportData } from './useReportData';

// ── Fixtures ──

function createMatrixState(overrides: Partial<MatrixState> = {}): MatrixState {
  return {
    versions: [
      { id: 'v1', label: 'Main', type: 'tab' },
      { id: 'v2', label: 'v1 (published)', type: 'published', version: 1 },
    ],
    models: [
      {
        modelId: 'm1',
        displayName: 'GPT-4o',
        providerName: 'OpenAI',
        temperature: 0.7,
        maxTokens: 4096,
        reasoningEffort: 'medium',
        isReasoning: false,
        showReasoning: false,
      },
      {
        modelId: 'm2',
        displayName: 'Claude 3.5',
        providerName: 'Anthropic',
        temperature: 1.0,
        maxTokens: 8192,
        reasoningEffort: 'high',
        isReasoning: true,
        showReasoning: true,
      },
    ],
    cells: {},
    selectedCell: null,
    selectedModelId: null,
    selectedVersionId: null,
    comparisonFilter: 'all',
    ...overrides,
  };
}

const sampleTemplateFields: TemplateField[] = [
  { name: 'topic', type: 'string', enumValues: [], defaultValue: null, description: null, min: null, max: null },
  { name: 'tone', type: 'enum', enumValues: ['formal', 'casual'], defaultValue: 'formal', description: null, min: null, max: null },
];

const sampleFieldValues: Record<string, string> = {
  topic: 'machine learning',
  tone: 'casual',
};

// ── Tests ──

describe('useReportData', () => {
  it('returns null when no completed cells exist', () => {
    const state = createMatrixState({
      cells: {
        'v1:m1': {
          versionId: 'v1',
          modelId: 'm1',
          status: 'empty',
          segments: [],
          score: null,
          evaluation: null,
          error: null,
          elapsedMs: null,
        },
      },
    });

    const { result } = renderHook(() =>
      useReportData({ state, fieldValues: {}, templateFields: [], entryTitle: 'Test' }),
    );

    expect(result.current).toBeNull();
  });

  it('returns null when cells map is empty', () => {
    const state = createMatrixState();

    const { result } = renderHook(() =>
      useReportData({ state, fieldValues: {}, templateFields: [], entryTitle: 'Test' }),
    );

    expect(result.current).toBeNull();
  });

  it('returns ReportData with correct metadata for completed cells', () => {
    const state = createMatrixState({
      cells: {
        'v1:m1': {
          versionId: 'v1',
          modelId: 'm1',
          status: 'completed',
          segments: [{ type: 'response', text: 'Hello', promptIndex: 0 }],
          score: 8,
          evaluation: {
            dimensions: { Accuracy: { score: 8, feedback: 'Good' } },
            averageScore: 8,
          },
          error: null,
          elapsedMs: 1500,
        },
        'v1:m2': {
          versionId: 'v1',
          modelId: 'm2',
          status: 'running',
          segments: [],
          score: null,
          evaluation: null,
          error: null,
          elapsedMs: null,
        },
      },
    });

    const { result } = renderHook(() =>
      useReportData({
        state,
        fieldValues: sampleFieldValues,
        templateFields: sampleTemplateFields,
        entryTitle: 'My Prompt',
      }),
    );

    expect(result.current).not.toBeNull();
    const data = result.current!;

    // Metadata
    expect(data.metadata.entryTitle).toBe('My Prompt');
    expect(data.metadata.totalVersions).toBe(2);
    expect(data.metadata.totalModels).toBe(2);
    expect(data.metadata.completedCells).toBe(1);
    expect(data.metadata.generatedAt).toBeTruthy();
  });

  it('maps model configs correctly', () => {
    const state = createMatrixState({
      cells: {
        'v1:m1': {
          versionId: 'v1',
          modelId: 'm1',
          status: 'completed',
          segments: [],
          score: null,
          evaluation: null,
          error: null,
          elapsedMs: 500,
        },
      },
    });

    const { result } = renderHook(() =>
      useReportData({ state, fieldValues: {}, templateFields: [], entryTitle: 'Test' }),
    );

    const data = result.current!;
    expect(data.runConfig).toHaveLength(2);
    expect(data.runConfig[0]).toEqual({
      modelId: 'm1',
      displayName: 'GPT-4o',
      providerName: 'OpenAI',
      temperature: 0.7,
      maxTokens: 4096,
      reasoningEffort: 'medium',
    });
  });

  it('maps template field values correctly', () => {
    const state = createMatrixState({
      cells: {
        'v1:m1': {
          versionId: 'v1',
          modelId: 'm1',
          status: 'completed',
          segments: [],
          score: null,
          evaluation: null,
          error: null,
          elapsedMs: 500,
        },
      },
    });

    const { result } = renderHook(() =>
      useReportData({
        state,
        fieldValues: sampleFieldValues,
        templateFields: sampleTemplateFields,
        entryTitle: 'Test',
      }),
    );

    const data = result.current!;
    expect(data.templateFields).toEqual([
      { name: 'topic', value: 'machine learning', type: 'string' },
      { name: 'tone', value: 'casual', type: 'enum' },
    ]);
  });

  it('substitutes template variables in rendered prompts', () => {
    const state = createMatrixState({
      cells: {
        'v1:m1': {
          versionId: 'v1',
          modelId: 'm1',
          status: 'completed',
          segments: [],
          score: null,
          evaluation: null,
          error: null,
          elapsedMs: 500,
        },
      },
    });

    const versionContents: Record<string, VersionContent> = {
      v1: {
        systemMessage: 'You are an expert on {{topic}}.',
        prompts: [{ content: 'Write about {{topic}} in a {{tone}} tone.' }],
      },
      v2: {
        systemMessage: null,
        prompts: [{ content: 'Tell me about {{topic}}.' }],
      },
    };

    const { result } = renderHook(() =>
      useReportData({
        state,
        fieldValues: sampleFieldValues,
        templateFields: sampleTemplateFields,
        entryTitle: 'Test',
        versionContents,
      }),
    );

    const data = result.current!;
    expect(data.renderedPrompts[0].systemMessage).toBe('You are an expert on machine learning.');
    expect(data.renderedPrompts[0].renderedPrompts[0]).toBe(
      'Write about machine learning in a casual tone.',
    );
    expect(data.renderedPrompts[1].systemMessage).toBeNull();
    expect(data.renderedPrompts[1].renderedPrompts[0]).toBe('Tell me about machine learning.');
  });

  it('preserves unmatched variables in prompts', () => {
    const state = createMatrixState({
      cells: {
        'v1:m1': {
          versionId: 'v1',
          modelId: 'm1',
          status: 'completed',
          segments: [],
          score: null,
          evaluation: null,
          error: null,
          elapsedMs: 500,
        },
      },
    });

    const versionContents: Record<string, VersionContent> = {
      v1: {
        systemMessage: null,
        prompts: [{ content: 'Hello {{unknown_var}}.' }],
      },
    };

    const { result } = renderHook(() =>
      useReportData({
        state,
        fieldValues: {},
        templateFields: [],
        entryTitle: 'Test',
        versionContents,
      }),
    );

    expect(result.current!.renderedPrompts[0].renderedPrompts[0]).toBe('Hello {{unknown_var}}.');
  });

  it('groups evaluation data correctly across cells', () => {
    const state = createMatrixState({
      cells: {
        'v1:m1': {
          versionId: 'v1',
          modelId: 'm1',
          status: 'completed',
          segments: [],
          score: 9,
          evaluation: {
            dimensions: {
              Accuracy: { score: 9, feedback: 'Excellent' },
              Clarity: { score: 8, feedback: 'Clear' },
            },
            averageScore: 8.5,
          },
          error: null,
          elapsedMs: 1000,
        },
        'v1:m2': {
          versionId: 'v1',
          modelId: 'm2',
          status: 'completed',
          segments: [],
          score: 6,
          evaluation: {
            dimensions: {
              Accuracy: { score: 6, feedback: 'Okay' },
              Clarity: { score: 7, feedback: 'Decent' },
            },
            averageScore: 6.5,
          },
          error: null,
          elapsedMs: 2000,
        },
      },
    });

    const { result } = renderHook(() =>
      useReportData({ state, fieldValues: {}, templateFields: [], entryTitle: 'Test' }),
    );

    const data = result.current!;
    expect(data.evaluationSummary).toHaveLength(2);
    expect(data.evaluationSummary[0].averageScore).toBe(8.5);
    expect(data.evaluationSummary[1].averageScore).toBe(6.5);
  });

  it('handles cells without evaluation data', () => {
    const state = createMatrixState({
      cells: {
        'v1:m1': {
          versionId: 'v1',
          modelId: 'm1',
          status: 'completed',
          segments: [{ type: 'response', text: 'Result', promptIndex: 0 }],
          score: null,
          evaluation: null,
          error: null,
          elapsedMs: 800,
        },
      },
    });

    const { result } = renderHook(() =>
      useReportData({ state, fieldValues: {}, templateFields: [], entryTitle: 'Test' }),
    );

    const data = result.current!;
    expect(data.evaluationSummary[0].evaluation).toBeNull();
    expect(data.evaluationSummary[0].averageScore).toBeNull();
    expect(data.fullResponses[0].segments).toHaveLength(1);
  });

  it('includes error cells in full responses but not evaluation summary', () => {
    const state = createMatrixState({
      cells: {
        'v1:m1': {
          versionId: 'v1',
          modelId: 'm1',
          status: 'completed',
          segments: [{ type: 'response', text: 'OK', promptIndex: 0 }],
          score: 7,
          evaluation: null,
          error: null,
          elapsedMs: 500,
        },
        'v1:m2': {
          versionId: 'v1',
          modelId: 'm2',
          status: 'error',
          segments: [],
          score: null,
          evaluation: null,
          error: 'Rate limit exceeded',
          elapsedMs: null,
        },
      },
    });

    const { result } = renderHook(() =>
      useReportData({ state, fieldValues: {}, templateFields: [], entryTitle: 'Test' }),
    );

    const data = result.current!;
    // Error cells appear in fullResponses
    expect(data.fullResponses).toHaveLength(2);
    expect(data.fullResponses[1].error).toBe('Rate limit exceeded');
    // But not in evaluationSummary (only completed)
    expect(data.evaluationSummary).toHaveLength(1);
  });
});
