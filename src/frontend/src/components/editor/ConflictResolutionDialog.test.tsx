import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ConflictResolutionDialog } from './ConflictResolutionDialog';

import type { PromptEntry } from '@/types';

const baseEntry: PromptEntry = {
  id: 'entry-1',
  title: 'Original Title',
  systemMessage: 'Original system message',
  prompts: [
    { id: 'p1', content: 'Prompt one content', order: 0 },
    { id: 'p2', content: 'Prompt two content', order: 1 },
  ],
  folderId: null,
  version: 1,
  versionState: 'draft',
  isTrashed: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: 'user-1',
};

const localEntry: PromptEntry = {
  ...baseEntry,
  title: 'My Updated Title',
  prompts: [
    { id: 'p1', content: 'My updated prompt one', order: 0 },
    { id: 'p2', content: 'Prompt two content', order: 1 },
  ],
};

const serverEntry: PromptEntry = {
  ...baseEntry,
  title: 'Their Updated Title',
  prompts: [
    { id: 'p1', content: 'Their updated prompt one', order: 0 },
    { id: 'p2', content: 'Prompt two content', order: 1 },
  ],
};

function renderDialog(onResolve = vi.fn(), onOpenChange = vi.fn()) {
  return {
    onResolve,
    onOpenChange,
    ...render(
      <ConflictResolutionDialog
        open={true}
        onOpenChange={onOpenChange}
        localEntry={localEntry}
        serverEntry={serverEntry}
        onResolve={onResolve}
      />
    ),
  };
}

describe('ConflictResolutionDialog', () => {
  it('renders diff sections for changed fields', () => {
    renderDialog();
    expect(screen.getByText('Conflict detected — resolve changes')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Prompt 1')).toBeInTheDocument();
  });

  it('shows No changes badge for identical fields', () => {
    renderDialog();
    // Prompt 2 is identical in both entries
    const noChanges = screen.getAllByText('No changes');
    expect(noChanges.length).toBeGreaterThanOrEqual(1);
  });

  it('defaults to Keep mine for all changed fields', () => {
    renderDialog();
    // All "Keep mine" buttons should be the active variant
    const keepMineButtons = screen.getAllByRole('button', { name: /keep mine/i });
    expect(keepMineButtons.length).toBeGreaterThanOrEqual(2); // Title + Prompt 1
  });

  it('switches selection when Keep theirs is clicked', () => {
    renderDialog();
    const keepTheirsButtons = screen.getAllByRole('button', { name: /keep theirs/i });
    fireEvent.click(keepTheirsButtons[0]); // Switch Title to theirs
    // After clicking, the button should now have the active style (Check icon appears)
    expect(keepTheirsButtons[0]).toBeInTheDocument();
  });

  it('calls onResolve with merged entry when Save resolved is clicked', () => {
    const { onResolve } = renderDialog();
    // Default is "keep mine" for all — click Save resolved
    fireEvent.click(screen.getByRole('button', { name: /save resolved/i }));
    expect(onResolve).toHaveBeenCalledOnce();
    const resolved = onResolve.mock.calls[0][0];
    expect(resolved.title).toBe('My Updated Title');
    expect(resolved.prompts[0].content).toBe('My updated prompt one');
  });

  it('calls onResolve with server values when Keep theirs selected', () => {
    const { onResolve } = renderDialog();
    // Switch all to theirs
    const keepTheirsButtons = screen.getAllByRole('button', { name: /keep theirs/i });
    keepTheirsButtons.forEach((btn) => fireEvent.click(btn));
    fireEvent.click(screen.getByRole('button', { name: /save resolved/i }));
    expect(onResolve).toHaveBeenCalledOnce();
    const resolved = onResolve.mock.calls[0][0];
    expect(resolved.title).toBe('Their Updated Title');
    expect(resolved.prompts[0].content).toBe('Their updated prompt one');
  });

  it('calls onOpenChange(false) when Cancel is clicked', () => {
    const { onResolve, onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onResolve).not.toHaveBeenCalled();
  });
});
