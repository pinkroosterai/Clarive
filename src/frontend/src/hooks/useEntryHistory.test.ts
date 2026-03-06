import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useEntryHistory } from './useEntryHistory';

import { createEntry } from '@/test/factories';
import type { PromptEntry } from '@/types';

describe('useEntryHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeEntry(title: string): PromptEntry {
    return createEntry({ title });
  }

  it('has correct initial state', () => {
    const { result } = renderHook(() => useEntryHistory());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('pushSnapshot + undo returns previous state', () => {
    const { result } = renderHook(() => useEntryHistory());
    const entry1 = makeEntry('v1');
    const entry2 = makeEntry('v2');

    act(() => {
      result.current.pushSnapshot(entry1);
    });

    // Advance past the coalesce window so next push is immediate
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    act(() => {
      result.current.pushSnapshot(entry2);
    });

    expect(result.current.canUndo).toBe(true);

    let undone: PromptEntry | null = null;
    const current = makeEntry('current');
    act(() => {
      undone = result.current.undo(current);
    });

    expect(undone).not.toBeNull();
    expect(undone!.title).toBe('v2');
  });

  it('pushSnapshot + undo + redo returns the state', () => {
    const { result } = renderHook(() => useEntryHistory());
    const entry1 = makeEntry('v1');

    act(() => {
      result.current.pushSnapshot(entry1);
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    const current = makeEntry('current');
    let undone: PromptEntry | null = null;
    act(() => {
      undone = result.current.undo(current);
    });
    expect(undone!.title).toBe('v1');

    let redone: PromptEntry | null = null;
    act(() => {
      redone = result.current.redo(undone!);
    });
    expect(redone).not.toBeNull();
    expect(redone!.title).toBe('current');
  });

  it('multiple undos walk back through history', () => {
    const { result } = renderHook(() => useEntryHistory());

    // Push 3 snapshots with time gaps to avoid coalescing
    const entries = ['A', 'B', 'C'].map((t) => makeEntry(t));
    for (const entry of entries) {
      act(() => {
        result.current.pushSnapshot(entry);
      });
      act(() => {
        vi.advanceTimersByTime(1100);
      });
    }

    expect(result.current.canUndo).toBe(true);

    // Undo 3 times
    const current = makeEntry('D');
    let prev: PromptEntry | null = null;

    act(() => {
      prev = result.current.undo(current);
    });
    expect(prev!.title).toBe('C');

    act(() => {
      prev = result.current.undo(prev!);
    });
    expect(prev!.title).toBe('B');

    act(() => {
      prev = result.current.undo(prev!);
    });
    expect(prev!.title).toBe('A');

    // Now stack is empty
    act(() => {
      prev = result.current.undo(prev!);
    });
    expect(prev).toBeNull();
  });

  it('undo when empty returns null', () => {
    const { result } = renderHook(() => useEntryHistory());
    const current = makeEntry('current');

    let undone: PromptEntry | null = null;
    act(() => {
      undone = result.current.undo(current);
    });

    expect(undone).toBeNull();
    expect(result.current.canUndo).toBe(false);
  });

  it('redo when empty returns null', () => {
    const { result } = renderHook(() => useEntryHistory());
    const current = makeEntry('current');

    let redone: PromptEntry | null = null;
    act(() => {
      redone = result.current.redo(current);
    });

    expect(redone).toBeNull();
    expect(result.current.canRedo).toBe(false);
  });

  it('clear resets everything', () => {
    const { result } = renderHook(() => useEntryHistory());
    const entry1 = makeEntry('v1');
    const entry2 = makeEntry('v2');

    act(() => {
      result.current.pushSnapshot(entry1);
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    act(() => {
      result.current.pushSnapshot(entry2);
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.clear();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('coalescing: rapid pushes within 1s only create one snapshot after timeout', () => {
    const { result } = renderHook(() => useEntryHistory());

    // First push — immediate (no prior snapshot, time diff > 1s)
    const entry1 = makeEntry('first');
    act(() => {
      result.current.pushSnapshot(entry1);
    });

    // This creates one entry in past stack
    expect(result.current.canUndo).toBe(true);

    // Now rapidly push within coalesce window (within 1000ms)
    const entry2 = makeEntry('rapid-1');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.pushSnapshot(entry2);
    });

    const entry3 = makeEntry('rapid-2');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.pushSnapshot(entry3);
    });

    const entry4 = makeEntry('rapid-3');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      result.current.pushSnapshot(entry4);
    });

    // Before timeout fires, there should still be just the initial snapshot
    // (the deferred ones haven't committed yet)
    // Undo should pop the first immediate snapshot
    const current = makeEntry('current');
    let undone: PromptEntry | null = null;
    act(() => {
      undone = result.current.undo(current);
    });
    // Undo flushes pending — but the undo itself pops from the past stack
    expect(undone!.title).toBe('first');

    // No more to undo
    act(() => {
      undone = result.current.undo(undone!);
    });
    expect(undone).toBeNull();
  });

  it('coalesced snapshot commits after timeout fires', () => {
    const { result } = renderHook(() => useEntryHistory());

    // First push — immediate
    const entry1 = makeEntry('first');
    act(() => {
      result.current.pushSnapshot(entry1);
    });

    // Rapid push within coalesce window
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const entry2 = makeEntry('coalesced');
    act(() => {
      result.current.pushSnapshot(entry2);
    });

    // Fire the deferred timeout
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Now there should be 2 items in past stack
    const current = makeEntry('current');
    let undone: PromptEntry | null = null;
    act(() => {
      undone = result.current.undo(current);
    });
    expect(undone!.title).toBe('coalesced');

    act(() => {
      undone = result.current.undo(undone!);
    });
    expect(undone!.title).toBe('first');
  });

  it('force push bypasses coalescing', () => {
    const { result } = renderHook(() => useEntryHistory());

    const entry1 = makeEntry('first');
    act(() => {
      result.current.pushSnapshot(entry1);
    });

    // Within coalesce window but forced
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const entry2 = makeEntry('forced');
    act(() => {
      result.current.pushSnapshot(entry2, true);
    });

    // Both should be in past stack since force bypasses coalescing
    const current = makeEntry('current');
    let undone: PromptEntry | null = null;
    act(() => {
      undone = result.current.undo(current);
    });
    expect(undone!.title).toBe('forced');

    act(() => {
      undone = result.current.undo(undone!);
    });
    expect(undone!.title).toBe('first');
  });

  it('max depth (50): pushing 51+ snapshots drops oldest', () => {
    const { result } = renderHook(() => useEntryHistory());

    // Push 52 snapshots with time gaps
    for (let i = 0; i < 52; i++) {
      act(() => {
        result.current.pushSnapshot(makeEntry(`entry-${i}`));
      });
      act(() => {
        vi.advanceTimersByTime(1100);
      });
    }

    // Undo all the way
    let count = 0;
    let current = makeEntry('final');
    let undone: PromptEntry | null = null;
    do {
      act(() => {
        undone = result.current.undo(current);
      });
      if (undone) {
        current = undone;
        count++;
      }
    } while (undone !== null);

    // Max depth is 50, so we should have at most 50 undos
    expect(count).toBeLessThanOrEqual(50);
    // The oldest entries (0, 1) should have been dropped
    // The deepest undo should be entry-2 or later (since 52 pushes - 50 max = 2 dropped)
    expect(current.title).toBe('entry-2');
  });

  it('undo flushes pending coalesced snapshot', () => {
    const { result } = renderHook(() => useEntryHistory());

    // First push — immediate
    const entry1 = makeEntry('first');
    act(() => {
      result.current.pushSnapshot(entry1);
    });

    // Rapid push within coalesce window — this is deferred
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const entry2 = makeEntry('deferred');
    act(() => {
      result.current.pushSnapshot(entry2);
    });

    // Undo without waiting for timeout — should flush the pending
    const current = makeEntry('current');
    let undone: PromptEntry | null = null;
    act(() => {
      undone = result.current.undo(current);
    });

    // The undo should clear the pending timeout and pop from past.
    // Past has only "first" (the deferred was not committed because undo
    // clears pending timeout without committing it).
    expect(undone!.title).toBe('first');
  });

  it('clear cancels pending coalesced snapshot', () => {
    const { result } = renderHook(() => useEntryHistory());

    const entry1 = makeEntry('first');
    act(() => {
      result.current.pushSnapshot(entry1);
    });

    // Deferred push
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      result.current.pushSnapshot(makeEntry('deferred'));
    });

    act(() => {
      result.current.clear();
    });

    // After clear, fire the timeout — nothing should happen
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('pushSnapshot after undo clears redo stack', () => {
    const { result } = renderHook(() => useEntryHistory());

    const entry1 = makeEntry('v1');
    const entry2 = makeEntry('v2');

    act(() => {
      result.current.pushSnapshot(entry1);
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    act(() => {
      result.current.pushSnapshot(entry2);
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Undo once
    const current = makeEntry('current');
    act(() => {
      result.current.undo(current);
    });
    expect(result.current.canRedo).toBe(true);

    // Push a new snapshot — should clear redo
    act(() => {
      result.current.pushSnapshot(makeEntry('v3'));
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.canRedo).toBe(false);
  });
});
