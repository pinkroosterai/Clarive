import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { RunMetadataBar } from './RunMetadataBar';

describe('RunMetadataBar', () => {
  it('renders tokens and cost', () => {
    render(
      <RunMetadataBar
        inputTokens={142}
        outputTokens={380}
        estimatedInputCostUsd={0.0002}
        estimatedOutputCostUsd={0.0021}
        elapsedMs={1200}
      />,
    );
    expect(screen.getByText(/142 in/)).toBeInTheDocument();
    expect(screen.getByText(/380 out/)).toBeInTheDocument();
    expect(screen.getByText(/~\$0\.0023/)).toBeInTheDocument();
    expect(screen.getByText(/1\.2s/)).toBeInTheDocument();
  });

  it('renders dash when cost is null', () => {
    render(
      <RunMetadataBar
        inputTokens={100}
        outputTokens={200}
        estimatedInputCostUsd={null}
        estimatedOutputCostUsd={null}
        elapsedMs={500}
      />,
    );
    expect(screen.getByText(/100 in/)).toBeInTheDocument();
    expect(screen.getByText(/\u2014/)).toBeInTheDocument();
  });

  it('returns null when all values are null', () => {
    const { container } = render(
      <RunMetadataBar
        inputTokens={null}
        outputTokens={null}
        estimatedInputCostUsd={null}
        estimatedOutputCostUsd={null}
        elapsedMs={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('comma-formats large token numbers', () => {
    render(
      <RunMetadataBar
        inputTokens={1234}
        outputTokens={56789}
        estimatedInputCostUsd={0.001}
        estimatedOutputCostUsd={0.05}
        elapsedMs={3000}
      />,
    );
    expect(screen.getByText(/1,234 in/)).toBeInTheDocument();
    expect(screen.getByText(/56,789 out/)).toBeInTheDocument();
  });

  it('renders cost from estimatedTotalCostUsd prop', () => {
    render(
      <RunMetadataBar
        inputTokens={100}
        outputTokens={200}
        estimatedTotalCostUsd={0.0045}
        elapsedMs={800}
      />,
    );
    expect(screen.getByText(/~\$0\.0045/)).toBeInTheDocument();
  });

  it('renders elapsed time in ms when under 1000', () => {
    render(
      <RunMetadataBar
        inputTokens={10}
        outputTokens={20}
        estimatedInputCostUsd={null}
        estimatedOutputCostUsd={null}
        elapsedMs={450}
      />,
    );
    expect(screen.getByText(/450ms/)).toBeInTheDocument();
  });
});
