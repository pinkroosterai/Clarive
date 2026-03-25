import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/components/editor/ActivityTimeline', () => ({
  ActivityTimeline: () => <div data-testid="activity-timeline" />,
}));

vi.mock('@/components/editor/TagEditor', () => ({
  TagEditor: () => <div data-testid="tag-editor" />,
}));

vi.mock('@/hooks/useAiEnabled', () => ({
  useAiEnabled: () => true,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/utils', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import { EditorActionPanel } from './EditorActionPanel';

import { TooltipProvider } from '@/components/ui/tooltip';
import { createDraftEntry, createVersionInfo } from '@/test/factories';

function renderPanel(props: Partial<Parameters<typeof EditorActionPanel>[0]> = {}) {
  const defaultProps = {
    entry: createDraftEntry(),
    isDirty: false,
    isReadOnly: false,
    onSave: vi.fn(),
    onDiscard: vi.fn(),
    onPublish: vi.fn(),
    onEnhance: vi.fn(),
    isSaving: false,
    isPublishing: false,
    folderName: 'My Folder',
    onMoveFolder: vi.fn(),
    onGenerateSystemMessage: vi.fn(),
    onDecomposeToChain: vi.fn(),
    isGeneratingSystemMessage: false,
    isDecomposing: false,
    showGenerateSystemMessage: true,
    showDecomposeToChain: true,
    versions: [createVersionInfo()],
    ...props,
  };
  return render(
    <TooltipProvider>
      <EditorActionPanel {...defaultProps} />
    </TooltipProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EditorActionPanel', () => {
  it('renders save button', () => {
    renderPanel();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('renders publish section', () => {
    renderPanel();
    // "Publish" text appears as button label in the Publish action group
    expect(screen.getAllByText('Publish').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSave when Save is clicked', () => {
    const onSave = vi.fn();
    renderPanel({ onSave, isDirty: true });

    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('disables save button when not dirty', () => {
    renderPanel({ isDirty: false });
    const btn = screen.getByText('Save').closest('button');
    expect(btn).toBeDisabled();
  });

  it('renders all three tab triggers', () => {
    renderPanel();
    expect(screen.getByRole('tab', { name: /actions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /versions/i })).toBeInTheDocument();
  });

  it('shows discard changes when dirty', () => {
    renderPanel({ isDirty: true });
    expect(screen.getByText('Discard Changes')).toBeInTheDocument();
  });

  it('shows "Saving..." text while saving', () => {
    renderPanel({ isSaving: true });
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });
});
