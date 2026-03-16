import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/components/editor/MarkdownEditor', () => ({
  MarkdownEditor: ({ content, placeholder }: { content: string; placeholder?: string }) => (
    <div data-testid="markdown-editor">{content || placeholder}</div>
  ),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/utils', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

import { PromptCard } from './PromptCard';

import { TooltipProvider } from '@/components/ui/tooltip';
import { createPrompt } from '@/test/factories';

function renderCard(props: Parameters<typeof PromptCard>[0]) {
  return render(
    <TooltipProvider>
      <PromptCard {...props} />
    </TooltipProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

const defaultProps = {
  prompt: createPrompt({ content: 'Hello {{name}}' }),
  index: 1,
  isOnly: false,
  isLast: false,
  isReadOnly: false,
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onMoveUp: vi.fn(),
  onMoveDown: vi.fn(),
};

describe('PromptCard', () => {
  it('renders prompt content via MarkdownEditor', () => {
    renderCard({ ...defaultProps });
    expect(screen.getByTestId('markdown-editor')).toHaveTextContent('Hello {{name}}');
  });

  it('renders prompt number', () => {
    renderCard({ ...defaultProps, index: 2 });
    expect(screen.getByText('Prompt #2')).toBeInTheDocument();
  });

  it('hides move/delete buttons when isOnly', () => {
    renderCard({ ...defaultProps, isOnly: true });
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });

  it('hides move/delete buttons in read-only mode', () => {
    renderCard({ ...defaultProps, isReadOnly: true });
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });

  it('calls onDelete when Remove is clicked', () => {
    const onDelete = vi.fn();
    renderCard({ ...defaultProps, onDelete });

    fireEvent.click(screen.getByText('Remove'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('hides syntax help button in read-only mode', () => {
    renderCard({ ...defaultProps, isReadOnly: true });
    expect(screen.queryByText('Syntax help')).not.toBeInTheDocument();
  });

  it('shows syntax help button when editable', () => {
    renderCard({ ...defaultProps });
    expect(screen.getByText('Syntax help')).toBeInTheDocument();
  });
});
