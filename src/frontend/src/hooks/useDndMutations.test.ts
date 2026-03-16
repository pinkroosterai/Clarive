import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services', () => ({
  entryService: {
    moveEntry: vi.fn(),
  },
  folderService: {
    moveFolder: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/handleApiError', () => ({
  handleApiError: vi.fn(),
}));

import { useDndMutations } from './useDndMutations';

import { entryService, folderService } from '@/services';

const mockMoveEntry = vi.mocked(entryService.moveEntry);
const mockMoveFolder = vi.mocked(folderService.moveFolder);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDndMutations', () => {
  it('moveEntry calls entryService.moveEntry', async () => {
    mockMoveEntry.mockResolvedValue({} as unknown);

    const { result } = renderHook(() => useDndMutations(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.moveEntry.mutate({ id: 'entry-1', folderId: 'folder-1' });
    });

    expect(mockMoveEntry).toHaveBeenCalledWith('entry-1', 'folder-1');
  });

  it('moveEntry supports null folderId (move to root)', async () => {
    mockMoveEntry.mockResolvedValue({} as unknown);

    const { result } = renderHook(() => useDndMutations(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.moveEntry.mutate({ id: 'entry-1', folderId: null });
    });

    expect(mockMoveEntry).toHaveBeenCalledWith('entry-1', null);
  });

  it('moveFolder calls folderService.moveFolder', async () => {
    mockMoveFolder.mockResolvedValue({} as unknown);

    const { result } = renderHook(() => useDndMutations(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.moveFolder.mutate({ id: 'folder-1', newParentId: 'folder-2' });
    });

    expect(mockMoveFolder).toHaveBeenCalledWith('folder-1', 'folder-2');
  });
});
