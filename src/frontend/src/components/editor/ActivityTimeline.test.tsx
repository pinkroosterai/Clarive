import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/services/api/activityService', () => ({
  getEntryActivity: vi.fn(),
}));

import { ActivityTimeline } from './ActivityTimeline';

import { getEntryActivity } from '@/services/api/activityService';

const mockGetActivity = vi.mocked(getEntryActivity);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ActivityTimeline', () => {
  it('shows "no activity" when query resolves with empty items', async () => {
    mockGetActivity.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    render(<ActivityTimeline entryId="entry-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument();
    });
  });

  it('renders activity items when data is available', async () => {
    mockGetActivity.mockResolvedValue({
      items: [
        {
          id: 'a-1',
          action: 'entry_created',
          userName: 'Alice',
          timestamp: new Date().toISOString(),
          version: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    render(<ActivityTimeline entryId="entry-1" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getByText(/Alice/)).toBeInTheDocument();
    });
  });
});
