import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { DiffBlock } from './DiffBlock';

describe('DiffBlock', () => {
  it('renders nothing when texts are identical', () => {
    const { container } = render(
      <DiffBlock label="Title" oldText="same text" newText="same text" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders label when texts differ', () => {
    render(<DiffBlock label="Title" oldText="old text" newText="new text" />);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('shows added lines with + prefix', () => {
    render(<DiffBlock label="Content" oldText="" newText="added line" />);
    expect(screen.getByText('+ added line')).toBeInTheDocument();
  });

  it('shows removed lines with - prefix', () => {
    render(<DiffBlock label="Content" oldText="removed line" newText="" />);
    expect(screen.getByText('- removed line')).toBeInTheDocument();
  });

  it('shows both added and removed for modifications', () => {
    render(<DiffBlock label="Content" oldText="old value" newText="new value" />);
    expect(screen.getByText('- old value')).toBeInTheDocument();
    expect(screen.getByText('+ new value')).toBeInTheDocument();
  });
});
