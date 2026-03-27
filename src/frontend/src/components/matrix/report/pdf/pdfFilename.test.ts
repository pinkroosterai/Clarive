import { describe, it, expect, vi, afterEach } from 'vitest';

import { buildPdfFilename, slugifyFilename } from './pdfFilename';

describe('slugifyFilename', () => {
  it('converts spaces to hyphens', () => {
    expect(slugifyFilename('My Prompt Entry')).toBe('my-prompt-entry');
  });

  it('removes special characters', () => {
    expect(slugifyFilename('Test @#$% Entry!')).toBe('test-entry');
  });

  it('collapses multiple hyphens', () => {
    expect(slugifyFilename('a---b   c')).toBe('a-b-c');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugifyFilename('---hello---')).toBe('hello');
  });

  it('truncates to 80 characters', () => {
    const longTitle = 'a'.repeat(100);
    expect(slugifyFilename(longTitle).length).toBe(80);
  });

  it('handles empty string', () => {
    expect(slugifyFilename('')).toBe('');
  });

  it('lowercases the result', () => {
    expect(slugifyFilename('UPPERCASE Title')).toBe('uppercase-title');
  });
});

describe('buildPdfFilename', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces correct filename format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-27T12:00:00Z'));

    const result = buildPdfFilename('My Test Prompt');
    expect(result).toBe('my-test-prompt-playground-report-2026-03-27.pdf');
  });

  it('uses "report" fallback for empty title', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'));

    const result = buildPdfFilename('');
    expect(result).toBe('report-playground-report-2026-01-15.pdf');
  });

  it('sanitizes special characters in title', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));

    const result = buildPdfFilename('Test & Compare: Models (v2)');
    expect(result).toBe('test-compare-models-v2-playground-report-2026-06-01.pdf');
  });
});
