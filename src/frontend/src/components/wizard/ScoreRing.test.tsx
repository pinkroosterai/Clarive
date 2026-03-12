import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ScoreRing } from './ScoreRing';

describe('ScoreRing', () => {
  it('renders the score text formatted to 1 decimal', () => {
    render(<ScoreRing score={8} />);
    expect(screen.getByText('8.0')).toBeInTheDocument();
  });

  it('renders aria-label with score and max', () => {
    render(<ScoreRing score={7.5} maxScore={10} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Quality score: 7.5 out of 10'
    );
  });

  it('renders an SVG element', () => {
    const { container } = render(<ScoreRing score={5} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
