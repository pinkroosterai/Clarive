import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useIsMobile } from './use-mobile';

describe('useIsMobile', () => {
  let listeners: Map<string, () => void>;
  let mockMatchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listeners = new Map();
    mockMatchMedia = vi.fn().mockReturnValue({
      addEventListener: (_event: string, handler: () => void) => {
        listeners.set('change', handler);
      },
      removeEventListener: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when window width is below 768', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 400 });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('returns false when window width is 768 or above', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('updates when media query changes', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    // Simulate resize below breakpoint
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 400 });
    act(() => {
      listeners.get('change')?.();
    });

    expect(result.current).toBe(true);
  });
});
