import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: { aiConfigured: boolean }) => boolean) =>
    selector({ aiConfigured: true }),
}));

import { useAiEnabled } from './useAiEnabled';

describe('useAiEnabled', () => {
  it('returns the aiConfigured value from auth store', () => {
    const { result } = renderHook(() => useAiEnabled());
    expect(result.current).toBe(true);
  });
});
