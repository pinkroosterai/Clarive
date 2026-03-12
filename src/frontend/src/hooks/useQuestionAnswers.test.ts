import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useQuestionAnswers } from './useQuestionAnswers';

const q2 = [
  { text: 'Q1', suggestions: ['s1a', 's1b'] },
  { text: 'Q2', suggestions: ['s2a', 's2b'] },
];
const q3 = [
  { text: 'Q1', suggestions: ['s1a'] },
  { text: 'Q2', suggestions: ['s2a'] },
  { text: 'Q3', suggestions: ['s3a'] },
];
const enh = ['e1', 'e2'];
const empty: string[] = [];

describe('useQuestionAnswers', () => {
  it('initializes answers as empty strings matching question count', () => {
    const { result } = renderHook(() => useQuestionAnswers(q2, enh));

    expect(result.current.answers).toEqual(['', '']);
    expect(result.current.selectedEnhancements).toEqual([]);
  });

  it('updateAnswer changes a specific answer by index', () => {
    const { result } = renderHook(() => useQuestionAnswers(q2, empty));

    act(() => {
      result.current.updateAnswer(1, 'my answer');
    });

    expect(result.current.answers).toEqual(['', 'my answer']);
  });

  it('selectSuggestion sets answer at index', () => {
    const { result } = renderHook(() => useQuestionAnswers(q2, empty));

    act(() => {
      result.current.selectSuggestion(0, 's1a');
    });

    expect(result.current.answers[0]).toBe('s1a');
  });

  it('toggleEnhancement adds and removes enhancements', () => {
    const { result } = renderHook(() => useQuestionAnswers(q2, enh));

    act(() => {
      result.current.toggleEnhancement('e1');
    });
    expect(result.current.selectedEnhancements).toEqual(['e1']);

    act(() => {
      result.current.toggleEnhancement('e2');
    });
    expect(result.current.selectedEnhancements).toEqual(['e1', 'e2']);

    // Toggle off
    act(() => {
      result.current.toggleEnhancement('e1');
    });
    expect(result.current.selectedEnhancements).toEqual(['e2']);
  });

  it('resets state when questions prop changes', () => {
    const { result, rerender } = renderHook(
      ({ q, e }) => useQuestionAnswers(q, e),
      { initialProps: { q: q2, e: enh } }
    );

    // Modify state
    act(() => {
      result.current.updateAnswer(0, 'filled');
      result.current.toggleEnhancement('e1');
    });
    expect(result.current.answers[0]).toBe('filled');
    expect(result.current.selectedEnhancements).toEqual(['e1']);

    // Rerender with new questions reference
    rerender({ q: q3, e: enh });
    expect(result.current.answers).toEqual(['', '', '']);
    expect(result.current.selectedEnhancements).toEqual([]);
  });
});
