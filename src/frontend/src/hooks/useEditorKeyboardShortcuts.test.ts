import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useEditorKeyboardShortcuts } from './useEditorKeyboardShortcuts';

const fireKeydown = (key: string, mods: Partial<KeyboardEvent> = {}) => {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: mods.ctrlKey ?? false,
      metaKey: mods.metaKey ?? false,
      shiftKey: mods.shiftKey ?? false,
      bubbles: true,
    })
  );
};

describe('useEditorKeyboardShortcuts', () => {
  let onSave: ReturnType<typeof vi.fn>;
  let onPublish: ReturnType<typeof vi.fn>;
  let onUndo: ReturnType<typeof vi.fn>;
  let onRedo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSave = vi.fn();
    onPublish = vi.fn();
    onUndo = vi.fn();
    onRedo = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers onSave on Ctrl+S', () => {
    renderHook(() =>
      useEditorKeyboardShortcuts({
        isReadOnly: false,
        onSave,
        onPublish,
        onUndo,
        onRedo,
      })
    );

    fireKeydown('s', { ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('triggers onPublish on Ctrl+Enter', () => {
    renderHook(() =>
      useEditorKeyboardShortcuts({
        isReadOnly: false,
        onSave,
        onPublish,
        onUndo,
        onRedo,
      })
    );

    fireKeydown('Enter', { ctrlKey: true });
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('triggers onUndo on Ctrl+Z', () => {
    renderHook(() =>
      useEditorKeyboardShortcuts({
        isReadOnly: false,
        onSave,
        onPublish,
        onUndo,
        onRedo,
      })
    );

    fireKeydown('z', { ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('triggers onRedo on Ctrl+Shift+Z', () => {
    renderHook(() =>
      useEditorKeyboardShortcuts({
        isReadOnly: false,
        onSave,
        onPublish,
        onUndo,
        onRedo,
      })
    );

    fireKeydown('Z', { ctrlKey: true, shiftKey: true });
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it('does not trigger any handlers in readOnly mode', () => {
    renderHook(() =>
      useEditorKeyboardShortcuts({
        isReadOnly: true,
        onSave,
        onPublish,
        onUndo,
        onRedo,
      })
    );

    fireKeydown('s', { ctrlKey: true });
    fireKeydown('Enter', { ctrlKey: true });
    fireKeydown('z', { ctrlKey: true });

    expect(onSave).not.toHaveBeenCalled();
    expect(onPublish).not.toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('does not trigger without modifier key', () => {
    renderHook(() =>
      useEditorKeyboardShortcuts({
        isReadOnly: false,
        onSave,
        onPublish,
        onUndo,
        onRedo,
      })
    );

    fireKeydown('s');
    fireKeydown('Enter');
    fireKeydown('z');

    expect(onSave).not.toHaveBeenCalled();
    expect(onPublish).not.toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('works with metaKey (Cmd on Mac)', () => {
    renderHook(() =>
      useEditorKeyboardShortcuts({
        isReadOnly: false,
        onSave,
        onPublish,
        onUndo,
        onRedo,
      })
    );

    fireKeydown('s', { metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('skips undo/redo when tiptap editor is focused', () => {
    // Create a mock tiptap element
    const tiptap = document.createElement('div');
    tiptap.classList.add('tiptap');
    const input = document.createElement('input');
    tiptap.appendChild(input);
    document.body.appendChild(tiptap);
    input.focus();

    renderHook(() =>
      useEditorKeyboardShortcuts({
        isReadOnly: false,
        onSave,
        onPublish,
        onUndo,
        onRedo,
      })
    );

    fireKeydown('z', { ctrlKey: true });
    expect(onUndo).not.toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(tiptap);
  });

  it('cleans up event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useEditorKeyboardShortcuts({
        isReadOnly: false,
        onSave,
        onPublish,
        onUndo,
        onRedo,
      })
    );

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
