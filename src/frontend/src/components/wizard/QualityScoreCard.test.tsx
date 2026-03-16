import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { QualityScoreCard } from './QualityScoreCard';

import { createEvaluation } from '@/test/factories';

describe('QualityScoreCard', () => {
  it('renders null when no evaluation provided', () => {
    const { container } = render(<QualityScoreCard />);
    expect(container.innerHTML).toBe('');
  });

  it('renders "Quality Analysis" heading', () => {
    render(<QualityScoreCard evaluation={createEvaluation()} />);
    expect(screen.getByText('Quality Analysis')).toBeInTheDocument();
  });

  it('renders dimension labels', () => {
    render(<QualityScoreCard evaluation={createEvaluation()} />);
    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.getByText('Effectiveness')).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Faithfulness')).toBeInTheDocument();
  });
});
