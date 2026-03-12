import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
}));

vi.mock('@/lib/templateParser', () => ({
  parseTemplateTags: () => [],
}));

import { TooltipProvider } from '@/components/ui/tooltip';

import { EntryCard } from './EntryCard';

import { createDraftEntry, createPublishedEntry } from '@/test/factories';

function renderCard(props: Partial<Parameters<typeof EntryCard>[0]> = {}) {
  const defaultProps = {
    entry: createDraftEntry({ title: 'Test Entry' }),
    onDuplicate: vi.fn(),
    onTrash: vi.fn(),
    ...props,
  };
  return render(
    <TooltipProvider>
      <MemoryRouter>
        <EntryCard {...defaultProps} />
      </MemoryRouter>
    </TooltipProvider>
  );
}

describe('EntryCard', () => {
  it('renders entry title', () => {
    renderCard();
    expect(screen.getByText('Test Entry')).toBeInTheDocument();
  });

  it('shows draft badge for draft entries', () => {
    renderCard({ entry: createDraftEntry() });
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows published badge for published entries', () => {
    renderCard({ entry: createPublishedEntry() });
    expect(screen.getByText('Published')).toBeInTheDocument();
  });

  it('renders entry with custom title', () => {
    renderCard({ entry: createDraftEntry({ title: 'Custom Title' }) });
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });
});
