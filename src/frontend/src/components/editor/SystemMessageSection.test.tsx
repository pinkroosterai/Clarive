import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/editor/MarkdownEditor', () => ({
  MarkdownEditor: ({ content, placeholder }: { content: string; placeholder?: string }) => (
    <div data-testid="markdown-editor">{content || placeholder}</div>
  ),
}));

import { SystemMessageSection } from './SystemMessageSection';

describe('SystemMessageSection', () => {
  it('shows "Add system message" button when systemMessage is null and not read-only', () => {
    render(<SystemMessageSection systemMessage={null} onChange={vi.fn()} isReadOnly={false} />);
    expect(screen.getByText('Add system message')).toBeInTheDocument();
  });

  it('hides "Add system message" button in read-only mode', () => {
    const { container } = render(
      <SystemMessageSection systemMessage={null} onChange={vi.fn()} isReadOnly={true} />
    );
    expect(container.querySelector('button')).toBeNull();
  });

  it('calls onChange with empty string when Add button is clicked', () => {
    const onChange = vi.fn();
    render(<SystemMessageSection systemMessage={null} onChange={onChange} isReadOnly={false} />);

    fireEvent.click(screen.getByText('Add system message'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('renders system message editor when message exists', () => {
    render(
      <SystemMessageSection
        systemMessage="You are a helpful assistant"
        onChange={vi.fn()}
        isReadOnly={false}
      />
    );
    expect(screen.getByText('System Message')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-editor')).toHaveTextContent('You are a helpful assistant');
  });

  it('shows remove button when not read-only and message exists', () => {
    const onChange = vi.fn();
    render(
      <SystemMessageSection systemMessage="Test" onChange={onChange} isReadOnly={false} />
    );

    // The X button to remove the system message
    const removeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('hides remove button in read-only mode', () => {
    render(
      <SystemMessageSection systemMessage="Test" onChange={vi.fn()} isReadOnly={true} />
    );

    // The collapsible trigger exists, but the X (remove) button should not
    const buttons = screen.queryAllByRole('button');
    // Only the collapsible trigger should be present, not the remove button
    expect(buttons.length).toBe(1);
    // The remove button renders an X icon with no accessible name
    // The collapsible trigger has "System Message" text
    expect(buttons[0]).toHaveTextContent('System Message');
  });
});
