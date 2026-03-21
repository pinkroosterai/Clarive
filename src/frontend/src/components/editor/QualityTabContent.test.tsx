import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { QualityTabContent } from './QualityTabContent';

import type { Evaluation, EvaluationEntry } from '@/types';

function createTestEvaluation(
  overrides?: Partial<Record<string, EvaluationEntry>>
): Evaluation {
  return {
    dimensions: {
      Clarity: { score: 8, feedback: 'Clear and concise.' },
      Effectiveness: { score: 7, feedback: 'Well structured.' },
      Completeness: { score: 6, feedback: 'Missing edge cases.' },
      Faithfulness: { score: 9, feedback: 'Stays on topic.' },
      ...overrides,
    },
  };
}

describe('QualityTabContent', () => {
  it('renders empty state when no evaluation exists', () => {
    render(
      <QualityTabContent
        isDirty={false}
        isEvaluating={false}
        onEvaluate={vi.fn()}
        versions={[]}
      />
    );
    expect(screen.getByText('No evaluation yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /evaluate/i })).toBeInTheDocument();
  });

  it('renders Evaluate button enabled when no evaluation exists', () => {
    render(
      <QualityTabContent
        isDirty={false}
        isEvaluating={false}
        onEvaluate={vi.fn()}
        versions={[]}
      />
    );
    const button = screen.getByRole('button', { name: /evaluate/i });
    expect(button).not.toBeDisabled();
  });

  it('renders all 4 dimension scores after evaluation', () => {
    render(
      <QualityTabContent
        evaluation={createTestEvaluation()}
        isDirty={false}
        isEvaluating={false}
        onEvaluate={vi.fn()}
        versions={[]}
      />
    );
    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.getByText('Effectiveness')).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Faithfulness')).toBeInTheDocument();
  });

  it('shows Re-evaluate label when evaluation exists and isDirty', () => {
    render(
      <QualityTabContent
        evaluation={createTestEvaluation()}
        isDirty={true}
        isEvaluating={false}
        onEvaluate={vi.fn()}
        versions={[]}
      />
    );
    expect(screen.getByRole('button', { name: /re-evaluate/i })).toBeInTheDocument();
  });

  it('disables button when not dirty and evaluation exists', () => {
    render(
      <QualityTabContent
        evaluation={createTestEvaluation()}
        isDirty={false}
        isEvaluating={false}
        onEvaluate={vi.fn()}
        versions={[]}
      />
    );
    const button = screen.getByRole('button', { name: /re-evaluate/i });
    expect(button).toBeDisabled();
  });

  it('shows loading spinner when isEvaluating is true', () => {
    render(
      <QualityTabContent
        isDirty={true}
        isEvaluating={true}
        onEvaluate={vi.fn()}
        versions={[]}
      />
    );
    expect(screen.getByRole('button', { name: /evaluating/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /evaluating/i })).toBeDisabled();
  });

  it('calls onEvaluate when button clicked', () => {
    const onEvaluate = vi.fn();
    render(
      <QualityTabContent
        isDirty={true}
        isEvaluating={false}
        onEvaluate={onEvaluate}
        versions={[]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /evaluate/i }));
    expect(onEvaluate).toHaveBeenCalledOnce();
  });

  it('prefers localEvaluation over entry evaluation', () => {
    const entryEval = createTestEvaluation({ Clarity: { score: 5, feedback: 'Old score' } });
    const localEval = createTestEvaluation({ Clarity: { score: 9, feedback: 'New score' } });

    render(
      <QualityTabContent
        evaluation={entryEval}
        localEvaluation={localEval}
        isDirty={true}
        isEvaluating={false}
        onEvaluate={vi.fn()}
        versions={[]}
      />
    );
    // The local evaluation's feedback should be shown
    expect(screen.getByText('New score')).toBeInTheDocument();
  });

  it('shows hint text when evaluation exists and not dirty', () => {
    render(
      <QualityTabContent
        evaluation={createTestEvaluation()}
        isDirty={false}
        isEvaluating={false}
        onEvaluate={vi.fn()}
        versions={[]}
      />
    );
    expect(screen.getByText('Edit the prompt to enable re-evaluation.')).toBeInTheDocument();
  });
});
