import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { StepProgress } from './StepProgress';

describe('StepProgress', () => {
  it('renders all step labels', () => {
    render(<StepProgress currentStep={1} totalSteps={3} labels={['Describe', 'Review', 'Save']} />);
    expect(screen.getByText('Describe')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('renders step numbers', () => {
    render(<StepProgress currentStep={1} totalSteps={2} labels={['Step 1', 'Step 2']} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
