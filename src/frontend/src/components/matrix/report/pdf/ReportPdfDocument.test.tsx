import { pdf } from '@react-pdf/renderer';
import { describe, it, expect } from 'vitest';

import type { ReportData } from '@/types/report';

import { ReportPdfDocument } from './ReportPdfDocument';

function createMockReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    metadata: {
      entryTitle: 'Test Prompt',
      generatedAt: '2026-03-27T12:00:00.000Z',
      totalVersions: 2,
      totalModels: 1,
      completedCells: 2,
    },
    runConfig: [
      {
        modelId: 'm1',
        displayName: 'GPT-4o',
        providerName: 'OpenAI',
        temperature: 0.7,
        maxTokens: 4096,
        reasoningEffort: 'medium',
      },
    ],
    templateFields: [{ name: 'topic', value: 'AI', type: 'string' }],
    renderedPrompts: [
      {
        versionLabel: 'Main',
        systemMessage: 'You are a helpful assistant.',
        renderedPrompts: ['Tell me about AI.'],
      },
    ],
    fullResponses: [
      {
        versionLabel: 'Main',
        modelDisplayName: 'GPT-4o',
        segments: [{ type: 'response', text: 'AI is transformative.', promptIndex: 0 }],
        elapsedMs: 1500,
        error: null,
      },
    ],
    evaluationSummary: [
      {
        versionLabel: 'Main',
        modelDisplayName: 'GPT-4o',
        evaluation: {
          dimensions: {
            Accuracy: { score: 9, feedback: 'Excellent' },
            Clarity: { score: 8, feedback: 'Clear' },
          },
          averageScore: 8.5,
        },
        averageScore: 8.5,
      },
    ],
    ...overrides,
  };
}

describe('ReportPdfDocument', () => {
  it('renders without errors for complete data', async () => {
    const data = createMockReportData();
    const doc = pdf(<ReportPdfDocument data={data} />);
    const blob = await doc.toBlob();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
  });

  it('renders without errors when no evaluations exist', async () => {
    const data = createMockReportData({
      evaluationSummary: [
        {
          versionLabel: 'Main',
          modelDisplayName: 'GPT-4o',
          evaluation: null,
          averageScore: null,
        },
      ],
    });
    const blob = await pdf(<ReportPdfDocument data={data} />).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders without errors when no rendered prompts exist', async () => {
    const data = createMockReportData({
      renderedPrompts: [
        { versionLabel: 'Main', systemMessage: null, renderedPrompts: [] },
      ],
    });
    const blob = await pdf(<ReportPdfDocument data={data} />).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders without errors for error cells', async () => {
    const data = createMockReportData({
      fullResponses: [
        {
          versionLabel: 'Main',
          modelDisplayName: 'GPT-4o',
          segments: [],
          elapsedMs: null,
          error: 'Rate limit exceeded',
        },
      ],
    });
    const blob = await pdf(<ReportPdfDocument data={data} />).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders without errors for empty template fields', async () => {
    const data = createMockReportData({ templateFields: [] });
    const blob = await pdf(<ReportPdfDocument data={data} />).toBlob();
    expect(blob.size).toBeGreaterThan(0);
  });
});
