import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services', () => ({
  entryService: {
    updateEntry: vi.fn(),
    publishEntry: vi.fn(),
    moveEntry: vi.fn(),
  },
  wizardService: {
    generateSystemMessage: vi.fn(),
    decomposeToChain: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/handleApiError', () => ({
  handleApiError: vi.fn(),
}));

import { useEditorMutations } from './useEditorMutations';

import { entryService, wizardService } from '@/services';
import { createDraftEntry } from '@/test/factories';

const mockUpdateEntry = vi.mocked(entryService.updateEntry);
const mockPublishEntry = vi.mocked(entryService.publishEntry);
const mockMoveEntry = vi.mocked(entryService.moveEntry);
const mockGenerateSystemMessage = vi.mocked(wizardService.generateSystemMessage);
const mockDecomposeToChain = vi.mocked(wizardService.decomposeToChain);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeOptions(overrides?: Partial<Parameters<typeof useEditorMutations>[0]>) {
  const entry = createDraftEntry();
  return {
    entryId: entry.id,
    localEntryRef: { current: entry },
    onSaveSuccess: vi.fn(),
    onPublishSuccess: vi.fn(),
    handleChange: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useEditorMutations', () => {
  it('handleSave calls updateEntry with local entry', async () => {
    const opts = makeOptions();
    mockUpdateEntry.mockResolvedValue({} as unknown);

    const { result } = renderHook(() => useEditorMutations(opts), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.handleSave();
    });

    expect(mockUpdateEntry).toHaveBeenCalledWith(
      opts.localEntryRef.current!.id,
      opts.localEntryRef.current
    );
    expect(opts.onSaveSuccess).toHaveBeenCalled();
  });

  it('handlePublish calls publishEntry', async () => {
    const opts = makeOptions();
    mockPublishEntry.mockResolvedValue({} as unknown);

    const { result } = renderHook(() => useEditorMutations(opts), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.handlePublish();
    });

    expect(mockPublishEntry).toHaveBeenCalledWith(opts.entryId);
    expect(opts.onPublishSuccess).toHaveBeenCalled();
  });

  it('moveMutation calls moveEntry', async () => {
    const opts = makeOptions();
    mockMoveEntry.mockResolvedValue({} as unknown);

    const { result } = renderHook(() => useEditorMutations(opts), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.moveMutation.mutate({ folderId: 'folder-1' });
    });

    expect(mockMoveEntry).toHaveBeenCalledWith(opts.entryId, 'folder-1');
  });

  it('handleGenerateSystemMessage updates entry via handleChange', async () => {
    const opts = makeOptions();
    mockGenerateSystemMessage.mockResolvedValue('Generated system message');

    const { result } = renderHook(() => useEditorMutations(opts), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleGenerateSystemMessage();
    });

    expect(mockGenerateSystemMessage).toHaveBeenCalledWith(opts.entryId);
    expect(opts.handleChange).toHaveBeenCalledWith(
      { systemMessage: 'Generated system message' },
      { force: true }
    );
  });

  it('handleDecomposeToChain updates prompts via handleChange', async () => {
    const decomposed = [{ content: 'Step 1' }, { content: 'Step 2' }];
    const opts = makeOptions();
    mockDecomposeToChain.mockResolvedValue(decomposed as unknown);

    const { result } = renderHook(() => useEditorMutations(opts), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleDecomposeToChain();
    });

    expect(mockDecomposeToChain).toHaveBeenCalledWith(opts.entryId);
    expect(opts.handleChange).toHaveBeenCalledWith({ prompts: decomposed }, { force: true });
  });

  it('skips generateSystemMessage when no entryId', async () => {
    const opts = makeOptions({ entryId: undefined });

    const { result } = renderHook(() => useEditorMutations(opts), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.handleGenerateSystemMessage();
    });

    expect(mockGenerateSystemMessage).not.toHaveBeenCalled();
  });
});
