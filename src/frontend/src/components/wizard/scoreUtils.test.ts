import { describe, it, expect } from 'vitest';

import { scoreColor } from './scoreUtils';

describe('scoreColor', () => {
  const allKeys = ['bar', 'text', 'bg', 'label', 'stroke'];

  it('returns success colors for score >= 8', () => {
    const result = scoreColor(9.0);
    expect(result.label).toBe('Good');
    expect(result.text).toBe('text-success-text');
    expect(result.bar).toBe('bg-success-text');
    expect(result.bg).toBe('bg-success-bg');
    expect(result.stroke).toBe('var(--success-text)');
  });

  it('returns warning colors for score >= 5 and < 8', () => {
    const result = scoreColor(6.5);
    expect(result.label).toBe('Fair');
    expect(result.text).toBe('text-warning-text');
    expect(result.bar).toBe('bg-warning-text');
    expect(result.bg).toBe('bg-warning-bg');
    expect(result.stroke).toBe('var(--warning-text)');
  });

  it('returns error colors for score < 5', () => {
    const result = scoreColor(3.0);
    expect(result.label).toBe('Poor');
    expect(result.text).toBe('text-error-text');
    expect(result.bar).toBe('bg-error-text');
    expect(result.bg).toBe('bg-error-bg');
    expect(result.stroke).toBe('var(--error-text)');
  });

  it('boundary: score = 8.0 is success', () => {
    expect(scoreColor(8.0).label).toBe('Good');
  });

  it('boundary: score = 5.0 is warning', () => {
    expect(scoreColor(5.0).label).toBe('Fair');
  });

  it('boundary: score = 4.9 is error', () => {
    expect(scoreColor(4.9).label).toBe('Poor');
  });

  it('returns all expected keys for every range', () => {
    for (const score of [9.0, 6.5, 3.0]) {
      const result = scoreColor(score);
      for (const key of allKeys) {
        expect(result).toHaveProperty(key);
      }
    }
  });
});
