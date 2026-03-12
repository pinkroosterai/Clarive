import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/hooks/useEntryHistory', () => ({
  useEntryHistory: () => ({
    pushSnapshot: vi.fn(),
    undo: vi.fn().mockReturnValue(null),
    redo: vi.fn().mockReturnValue(null),
    clear: vi.fn(),
    canUndo: false,
    canRedo: false,
  }),
}));

vi.mock('@/lib/deepEqual', () => ({
  deepEqual: vi.fn().mockReturnValue(false),
}));

import { useEditorState } from './useEditorState';

import { toast } from 'sonner';
import type { PromptEntry } from '@/types';

import { createPublishedEntry, createDraftEntry } from '@/test/factories';

const mockToastSuccess = vi.mocked(toast.success);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  document.title = '';
});

describe('useEditorState', () => {
  it('initializes with null localEntry when no entryData', () => {
    const { result } = renderHook(() => useEditorState(undefined));

    expect(result.current.localEntry).toBeNull();
    expect(result.current.isDirty).toBe(false);
  });

  it('syncs server data to local state', () => {
    const entry = createDraftEntry({ title: 'My Entry' });
    const { result } = renderHook(() => useEditorState(entry));

    expect(result.current.localEntry?.title).toBe('My Entry');
  });

  it('sets document title from entry title', () => {
    const entry = createDraftEntry({ title: 'Test Title' });
    renderHook(() => useEditorState(entry));

    expect(document.title).toBe('Clarive — Test Title');
  });

  it('sets default document title when no entry', () => {
    renderHook(() => useEditorState(undefined));

    expect(document.title).toBe('Clarive — Editor');
  });

  it('handleChange marks state as dirty', () => {
    const entry = createDraftEntry();
    const { result } = renderHook(() => useEditorState(entry));

    act(() => {
      result.current.handleChange({ title: 'Updated' });
    });

    expect(result.current.isDirty).toBe(true);
    expect(result.current.localEntry?.title).toBe('Updated');
  });

  it('handleDiscard resets to server data and clears dirty', () => {
    const entry = createDraftEntry({ title: 'Original' });
    const { result } = renderHook(() => useEditorState(entry));

    act(() => {
      result.current.handleChange({ title: 'Changed' });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.handleDiscard();
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.localEntry?.title).toBe('Original');
    expect(mockToastSuccess).toHaveBeenCalledWith('Changes discarded');
  });

  it('shows edit notice on first change to published entry', () => {
    const entry = createPublishedEntry();
    const { result } = renderHook(() => useEditorState(entry));

    expect(result.current.showEditNotice).toBe(false);

    act(() => {
      result.current.handleChange({ title: 'Edit Published' });
    });

    expect(result.current.showEditNotice).toBe(true);
  });

  it('registers beforeunload handler', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const entry = createDraftEntry();

    renderHook(() => useEditorState(entry));

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });
});
