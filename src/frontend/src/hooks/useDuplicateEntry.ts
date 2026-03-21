import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { handleApiError } from '@/lib/handleApiError';
import { entryService } from '@/services';
import type { PromptEntry } from '@/types';

interface FolderPickerState {
  open: boolean;
  source: PromptEntry | null;
}

export function useDuplicateEntry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [folderPickerState, setFolderPickerState] = useState<FolderPickerState>({
    open: false,
    source: null,
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ source, folderId }: { source: PromptEntry; folderId: string | null }) => {
      const full = await entryService.getEntry(source.id);
      const created = await entryService.createEntry({
        title: `${full.title} (copy)`,
        systemMessage: full.systemMessage,
        prompts: full.prompts,
        folderId,
      });
      // Clone tags if present
      if (full.tags && full.tags.length > 0) {
        await entryService.addTags(created.id, full.tags).catch(() => {});
      }
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Entry duplicated');
      navigate(`/entry/${created.id}`);
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const startDuplicate = useCallback((source: PromptEntry) => {
    setFolderPickerState({ open: true, source });
  }, []);

  const confirmDuplicate = useCallback(
    (folderId: string | null) => {
      if (folderPickerState.source) {
        duplicateMutation.mutate({ source: folderPickerState.source, folderId });
      }
      setFolderPickerState({ open: false, source: null });
    },
    [folderPickerState.source, duplicateMutation]
  );

  const cancelDuplicate = useCallback(() => {
    setFolderPickerState({ open: false, source: null });
  }, []);

  return {
    startDuplicate,
    confirmDuplicate,
    cancelDuplicate,
    folderPickerState,
    isDuplicating: duplicateMutation.isPending,
  };
}
