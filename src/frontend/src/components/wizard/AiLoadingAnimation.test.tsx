import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AiLoadingAnimation } from './AiLoadingAnimation';

describe('AiLoadingAnimation', () => {
  it('renders without crashing', () => {
    const { container } = render(<AiLoadingAnimation />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders SVG element', () => {
    const { container } = render(<AiLoadingAnimation />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
