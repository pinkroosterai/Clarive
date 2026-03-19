import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import QueueStrip from './QueueStrip';
import type { QueuedModel } from './utils';

import type { EnrichedModel } from '@/services/api/playgroundService';

function makeModel(overrides: Partial<EnrichedModel> = {}): EnrichedModel {
  return {
    modelId: 'model-1',
    displayName: 'Model One',
    providerId: 'prov-1',
    providerName: 'Provider A',
    isReasoning: false,
    supportsFunctionCalling: false,
    supportsResponseSchema: false,
    maxInputTokens: null,
    maxOutputTokens: null,
    defaultTemperature: null,
    defaultMaxTokens: null,
    defaultReasoningEffort: null,
    ...overrides,
  };
}

const nonReasoningItem: QueuedModel = {
  model: makeModel({ modelId: 'gpt-4o', displayName: 'GPT-4o' }),
  temperature: 0.7,
  maxTokens: 4096,
  reasoningEffort: 'medium',
  showReasoning: false,
  isReasoning: false,
};

const reasoningItem: QueuedModel = {
  model: makeModel({ modelId: 'o3-mini', displayName: 'o3-mini', isReasoning: true }),
  temperature: 1.0,
  maxTokens: 8192,
  reasoningEffort: 'high',
  showReasoning: true,
  isReasoning: true,
};

function renderStrip(overrides: Partial<React.ComponentProps<typeof QueueStrip>> = {}) {
  const props = {
    queue: [nonReasoningItem, reasoningItem],
    onRemove: vi.fn(),
    onClear: vi.fn(),
    onRunQueue: vi.fn(),
    isStreaming: false,
    isBatchRunning: false,
    batchCurrent: 0,
    batchTotal: 0,
    ...overrides,
  };
  return { ...render(<QueueStrip {...props} />), ...props };
}

describe('QueueStrip', () => {
  it('renders queue items with model names', () => {
    renderStrip();
    expect(screen.getByText('GPT-4o')).toBeInTheDocument();
    expect(screen.getByText('o3-mini')).toBeInTheDocument();
  });

  it('shows temperature for non-reasoning models', () => {
    renderStrip();
    expect(screen.getByText('temp 0.7 · 4096 tok')).toBeInTheDocument();
  });

  it('shows reasoning effort for reasoning models', () => {
    renderStrip();
    expect(screen.getByText('reasoning:high · 8192 tok')).toBeInTheDocument();
  });

  it('shows queue count', () => {
    renderStrip();
    expect(screen.getByText('Queue (2)')).toBeInTheDocument();
  });

  it('calls onRemove with correct index', () => {
    const { onRemove } = renderStrip();
    const removeButtons = screen.getAllByLabelText(/Remove/);
    fireEvent.click(removeButtons[1]); // Remove o3-mini (index 1)
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('calls onClear when Clear button clicked', () => {
    const { onClear } = renderStrip();
    fireEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('calls onRunQueue when Run Queue button clicked', () => {
    const { onRunQueue } = renderStrip();
    fireEvent.click(screen.getByText('Run Queue (2)'));
    expect(onRunQueue).toHaveBeenCalled();
  });

  it('hides action buttons during streaming', () => {
    renderStrip({ isStreaming: true });
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    expect(screen.queryByText('Run Queue (2)')).not.toBeInTheDocument();
  });

  it('hides remove buttons during streaming', () => {
    renderStrip({ isStreaming: true });
    expect(screen.queryAllByLabelText(/Remove/)).toHaveLength(0);
  });

  it('shows batch progress when running', () => {
    renderStrip({ isBatchRunning: true, batchCurrent: 2, batchTotal: 3, queue: [] });
    expect(screen.getByText('Running 2/3')).toBeInTheDocument();
  });
});
