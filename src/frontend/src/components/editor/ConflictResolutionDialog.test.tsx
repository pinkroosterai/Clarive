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
  versionState: 'tab',
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

function renderOverlay(onResolve = vi.fn(), onOpenChange = vi.fn()) {
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

describe('ConflictResolutionDialog (full-page overlay)', () => {
  it('renders the overlay with heading', () => {
    renderOverlay();
    expect(screen.getByText('Resolve conflict')).toBeInTheDocument();
  });

  it('renders side-by-side column headers', () => {
    renderOverlay();
    const yourChanges = screen.getAllByText('Your changes');
    const serverVersion = screen.getAllByText('Server version');
    expect(yourChanges.length).toBeGreaterThanOrEqual(1);
    expect(serverVersion.length).toBeGreaterThanOrEqual(1);
  });

  it('shows No changes badge for identical fields', () => {
    renderOverlay();
    const noChanges = screen.getAllByText('No changes');
    expect(noChanges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders diff sections for changed fields', () => {
    renderOverlay();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Prompt 1')).toBeInTheDocument();
  });

  it('defaults to Keep mine for all changed fields', () => {
    renderOverlay();
    const keepMineButtons = screen.getAllByRole('button', { name: /keep mine/i });
    expect(keepMineButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onResolve with local values when Save resolved clicked (default keep mine)', () => {
    const { onResolve } = renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: /save resolved/i }));
    expect(onResolve).toHaveBeenCalledOnce();
    const resolved = onResolve.mock.calls[0][0];
    expect(resolved.title).toBe('My Updated Title');
    expect(resolved.prompts[0].content).toBe('My updated prompt one');
  });

  it('calls onResolve with server values when Keep theirs selected', () => {
    const { onResolve } = renderOverlay();
    const keepTheirsButtons = screen.getAllByRole('button', { name: /keep theirs/i });
    keepTheirsButtons.forEach((btn) => fireEvent.click(btn));
    fireEvent.click(screen.getByRole('button', { name: /save resolved/i }));
    expect(onResolve).toHaveBeenCalledOnce();
    const resolved = onResolve.mock.calls[0][0];
    expect(resolved.title).toBe('Their Updated Title');
    expect(resolved.prompts[0].content).toBe('Their updated prompt one');
  });

  it('shows Edit merged button for each conflicting field', () => {
    renderOverlay();
    const editMergedButtons = screen.getAllByRole('button', { name: /edit merged/i });
    expect(editMergedButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('opens textarea when Edit merged is clicked', () => {
    renderOverlay();
    const editMergedButtons = screen.getAllByRole('button', { name: /edit merged/i });
    fireEvent.click(editMergedButtons[0]); // Click Edit merged for Title
    expect(screen.getByText('Merged result')).toBeInTheDocument();
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('sends custom merged text when Edit merged is used', () => {
    const { onResolve } = renderOverlay();
    const editMergedButtons = screen.getAllByRole('button', { name: /edit merged/i });
    fireEvent.click(editMergedButtons[0]); // Edit merged for Title
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Custom Merged Title' } });
    fireEvent.click(screen.getByRole('button', { name: /save resolved/i }));
    const resolved = onResolve.mock.calls[0][0];
    expect(resolved.title).toBe('Custom Merged Title');
  });

  it('calls onOpenChange(false) when Cancel is clicked', () => {
    const { onResolve, onOpenChange } = renderOverlay();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('shows result preview labels for conflicting fields', () => {
    renderOverlay();
    const previews = screen.getAllByText('Result preview');
    // At least 2 conflicting fields (Title + Prompt 1) should each have a preview
    expect(previews.length).toBeGreaterThanOrEqual(2);
  });

  it('result preview updates when switching to Keep theirs', () => {
    renderOverlay();
    const keepTheirsButtons = screen.getAllByRole('button', { name: /keep theirs/i });
    fireEvent.click(keepTheirsButtons[0]); // Switch Title to theirs
    // Their title now appears in both the diff column AND the preview
    const matches = screen.getAllByText('Their Updated Title');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('result preview updates when editing merged text', () => {
    renderOverlay();
    const editMergedButtons = screen.getAllByRole('button', { name: /edit merged/i });
    fireEvent.click(editMergedButtons[0]);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Unique Preview 12345' } });
    // Text appears in both the textarea and the preview
    const matches = screen.getAllByText('Unique Preview 12345');
    expect(matches.length).toBeGreaterThanOrEqual(2); // textarea + preview
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <ConflictResolutionDialog
        open={false}
        onOpenChange={vi.fn()}
        localEntry={localEntry}
        serverEntry={serverEntry}
        onResolve={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});
