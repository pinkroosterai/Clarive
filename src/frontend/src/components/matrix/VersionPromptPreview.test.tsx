import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import { VersionPromptPreview } from './VersionPromptPreview';

import type { PromptEntry } from '@/types';

const mockContent: PromptEntry = {
  id: 'entry-1',
  title: 'Test Entry',
  systemMessage: 'You are a helpful assistant.',
  prompts: [
    { id: 'p1', content: 'Write about {{topic}} in {{tone}} tone.', order: 0 },
    { id: 'p2', content: 'Now summarize the above.', order: 1 },
  ],
  folderId: null,
  version: 3,
  versionState: 'published',
  isTrashed: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderPreview(overrides: Partial<{
  content: PromptEntry;
  fieldValues: Record<string, string>;
}> = {}) {
  const defaults = {
    entryId: 'entry-1',
    content: mockContent,
    fieldValues: {} as Record<string, string>,
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <VersionPromptPreview {...defaults} />
    </MemoryRouter>,
  );
}

describe('VersionPromptPreview', () => {
  it('renders entry title', () => {
    renderPreview();
    expect(screen.getByText('Test Entry')).toBeInTheDocument();
  });

  it('renders system message when present', () => {
    renderPreview();
    expect(screen.getByText('System Message')).toBeInTheDocument();
    expect(screen.getByText('You are a helpful assistant.')).toBeInTheDocument();
  });

  it('hides system message section when null', () => {
    renderPreview({
      content: { ...mockContent, systemMessage: null },
    });
    expect(screen.queryByText('System Message')).not.toBeInTheDocument();
  });

  it('renders numbered prompt labels', () => {
    renderPreview();
    expect(screen.getByText('Prompt #1')).toBeInTheDocument();
    expect(screen.getByText('Prompt #2')).toBeInTheDocument();
  });

  it('substitutes template variables with fieldValues', () => {
    renderPreview({ fieldValues: { topic: 'quantum computing', tone: 'friendly' } });
    expect(screen.getByText(/quantum computing/)).toBeInTheDocument();
    expect(screen.getByText(/friendly/)).toBeInTheDocument();
  });

  it('leaves template tags as-is when fieldValues are empty', () => {
    renderPreview({ fieldValues: {} });
    expect(screen.getByText(/\{\{topic\}\}/)).toBeInTheDocument();
  });

  it('renders View in editor link', () => {
    renderPreview();
    const link = screen.getByText('Editor');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/entry/entry-1');
  });

  it('renders prompts in order', () => {
    renderPreview({
      content: {
        ...mockContent,
        prompts: [
          { id: 'p2', content: 'Second prompt', order: 1 },
          { id: 'p1', content: 'First prompt', order: 0 },
        ],
      },
    });
    const labels = screen.getAllByText(/Prompt #\d/);
    expect(labels[0]).toHaveTextContent('Prompt #1');
    expect(labels[1]).toHaveTextContent('Prompt #2');
  });
});
