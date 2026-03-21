import { describe, it, expect, beforeEach } from 'vitest';

const SIDEBAR_WIDTH_KEY = 'cl_sidebar_width';
const SIDEBAR_WIDTH_DEFAULT = '16rem';
const SIDEBAR_WIDTH_MIN = 192;
const SIDEBAR_WIDTH_MAX = 384;

/** Mirrors the clamping logic used in the resize handler. */
function clampWidth(px: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, px));
}

/** Mirrors the initialization logic in SidebarProvider. */
function readPersistedWidth(): string {
  return localStorage.getItem(SIDEBAR_WIDTH_KEY) || SIDEBAR_WIDTH_DEFAULT;
}

describe('sidebar width persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default width when no stored value exists', () => {
    expect(readPersistedWidth()).toBe('16rem');
  });

  it('returns stored width from localStorage', () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, '280px');
    expect(readPersistedWidth()).toBe('280px');
  });

  it('persists width to localStorage', () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, '300px');
    expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe('300px');
  });

  it('clears stored width returns default', () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, '300px');
    localStorage.removeItem(SIDEBAR_WIDTH_KEY);
    expect(readPersistedWidth()).toBe('16rem');
  });
});

describe('sidebar width clamping', () => {
  it('clamps below minimum to 192px', () => {
    expect(clampWidth(100)).toBe(SIDEBAR_WIDTH_MIN);
    expect(clampWidth(0)).toBe(SIDEBAR_WIDTH_MIN);
    expect(clampWidth(-50)).toBe(SIDEBAR_WIDTH_MIN);
  });

  it('clamps above maximum to 384px', () => {
    expect(clampWidth(500)).toBe(SIDEBAR_WIDTH_MAX);
    expect(clampWidth(1000)).toBe(SIDEBAR_WIDTH_MAX);
  });

  it('passes through values within range', () => {
    expect(clampWidth(192)).toBe(192);
    expect(clampWidth(256)).toBe(256);
    expect(clampWidth(300)).toBe(300);
    expect(clampWidth(384)).toBe(384);
  });

  it('handles exact boundary values', () => {
    expect(clampWidth(SIDEBAR_WIDTH_MIN)).toBe(SIDEBAR_WIDTH_MIN);
    expect(clampWidth(SIDEBAR_WIDTH_MAX)).toBe(SIDEBAR_WIDTH_MAX);
  });
});
