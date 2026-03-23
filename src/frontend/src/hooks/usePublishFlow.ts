import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { entryService } from '@/services';
import type { PromptEntry, VersionInfo } from '@/types';

interface UsePublishFlowOptions {
  entryId: string | undefined;
  versionNum: number | undefined;
  versions: VersionInfo[];
  localEntry: PromptEntry | null;
  handlePublish: () => void;
}

export function usePublishFlow({
  entryId,
  versionNum,
  versions,
  localEntry,
  handlePublish,
}: UsePublishFlowOptions) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const hasDraft = versions.some((v) => v.versionState === 'draft');
  const draftVersion = versions.find((v) => v.versionState === 'draft')?.version;

  const promoteMutation = useMutation({
    mutationFn: () => entryService.promoteVersion(entryId!, versionNum!),
    onSuccess: (promoted) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      toast.success('Version restored as new draft');
      navigate(`/entry/${promoted.id}`);
    },
    onError: () => toast.error('Failed to restore version'),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: () => entryService.deleteDraft(entryId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      toast.success('Draft deleted, reverted to published version');
      navigate(`/entry/${entryId}`);
    },
    onError: () => toast.error('Failed to delete draft'),
  });

  const [showEmptyPublishWarning, setShowEmptyPublishWarning] = useState(false);

  const handlePublishWithCheck = useCallback(() => {
    if (!hasDraft) return;
    if (!localEntry?.title?.trim()) {
      toast.error('Title is required to publish');
      return;
    }
    const allEmpty = localEntry?.prompts?.every((p) => !p.content?.trim());
    if (allEmpty) {
      setShowEmptyPublishWarning(true);
    } else {
      handlePublish();
    }
  }, [hasDraft, localEntry, handlePublish]);

  return {
    hasDraft,
    draftVersion,
    promoteMutation,
    deleteDraftMutation,
    showEmptyPublishWarning,
    setShowEmptyPublishWarning,
    handlePublishWithCheck,
  };
}
