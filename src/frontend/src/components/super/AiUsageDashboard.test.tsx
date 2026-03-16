import { render, screen } from '@testing-library/react';
import { vi, beforeAll } from 'vitest';
import type { AiUsageStatsResponse } from '@/services/api/aiUsageService';

// Recharts uses ResizeObserver which isn't available in jsdom
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

vi.mock('@/hooks/useAiUsage', () => ({
  useAiUsageStats: vi.fn(),
  useAiUsageFilters: vi.fn().mockReturnValue({ data: { models: [], actionTypes: [], tenants: [] }, isLoading: false }),
  useAiUsageLogs: vi.fn().mockReturnValue({ data: { items: [], totalCount: 0 }, isLoading: false }),
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, transition, whileHover, whileTap, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
  },
  useSpring: () => ({ set: vi.fn() }),
  useTransform: (_: unknown, fn: (v: number) => string) => fn(0),
}));

// Mock ag-grid-react to avoid DOM measurement issues in jsdom
vi.mock('ag-grid-react', () => ({
  AgGridReact: () => <div data-testid="ag-grid-mock" />,
}));

import AiUsageDashboard from './AiUsageDashboard';
import { useAiUsageStats } from '@/hooks/useAiUsage';

const mockUseAiUsageStats = vi.mocked(useAiUsageStats);

const mockStats: AiUsageStatsResponse = {
  totals: { totalRequests: 100, totalInputTokens: 5000, totalOutputTokens: 3000, totalTokens: 8000, totalEstimatedInputCostUsd: 0.50, totalEstimatedOutputCostUsd: 1.20, totalEstimatedCostUsd: 1.70 },
  averages: { avgInputTokensPerRequest: 50, avgOutputTokensPerRequest: 30, avgTotalTokensPerRequest: 80 },
  byModel: [
    { name: 'gpt-4o', requestCount: 60, inputTokens: 3000, outputTokens: 1800, totalTokens: 4800, percentage: 60, estimatedInputCostUsd: 0.30, estimatedOutputCostUsd: 0.72, estimatedCostUsd: 1.02 },
    { name: 'claude-3', requestCount: 40, inputTokens: 2000, outputTokens: 1200, totalTokens: 3200, percentage: 40, estimatedInputCostUsd: 0.20, estimatedOutputCostUsd: 0.48, estimatedCostUsd: 0.68 },
  ],
  byTenant: [
    { name: 'Acme Corp', requestCount: 70, inputTokens: 3500, outputTokens: 2100, totalTokens: 5600, percentage: 70, estimatedInputCostUsd: 0.35, estimatedOutputCostUsd: 0.84, estimatedCostUsd: 1.19 },
  ],
  byUser: [
    { name: 'admin@test.com', requestCount: 100, inputTokens: 5000, outputTokens: 3000, totalTokens: 8000, percentage: 100, estimatedInputCostUsd: 0.50, estimatedOutputCostUsd: 1.20, estimatedCostUsd: 1.70 },
  ],
  byActionType: [
    { name: 'PlaygroundTest', requestCount: 80, inputTokens: 4000, outputTokens: 2400, totalTokens: 6400, percentage: 80, estimatedInputCostUsd: 0.40, estimatedOutputCostUsd: 0.96, estimatedCostUsd: 1.36 },
    { name: 'Generation', requestCount: 20, inputTokens: 1000, outputTokens: 600, totalTokens: 1600, percentage: 20, estimatedInputCostUsd: 0.10, estimatedOutputCostUsd: 0.24, estimatedCostUsd: 0.34 },
  ],
};

describe('AiUsageDashboard', () => {
  it('shows loading skeletons when data is loading', () => {
    mockUseAiUsageStats.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useAiUsageStats>);

    const { container } = render(<AiUsageDashboard />);
    // Skeleton elements have the animate-pulse class
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no data', () => {
    mockUseAiUsageStats.mockReturnValue({
      data: {
        totals: { totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalEstimatedInputCostUsd: 0, totalEstimatedOutputCostUsd: 0, totalEstimatedCostUsd: 0 },
        averages: { avgInputTokensPerRequest: 0, avgOutputTokensPerRequest: 0, avgTotalTokensPerRequest: 0 },
        byModel: [],
        byTenant: [],
        byUser: [],
        byActionType: [],
      },
      isLoading: false,
    } as ReturnType<typeof useAiUsageStats>);

    render(<AiUsageDashboard />);
    expect(screen.getByText('No AI usage data yet for this period.')).toBeInTheDocument();
  });

  it('renders summary cards and log grid when data exists', () => {
    mockUseAiUsageStats.mockReturnValue({
      data: mockStats,
      isLoading: false,
    } as ReturnType<typeof useAiUsageStats>);

    render(<AiUsageDashboard />);

    // Date filter buttons
    expect(screen.getByText('24h')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();

    // Chart heading
    expect(screen.getByText('Token Usage by Model')).toBeInTheDocument();

    // AG Grid log grid is rendered (mocked)
    expect(screen.getByTestId('ag-grid-mock')).toBeInTheDocument();
  });
});
