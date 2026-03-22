import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useRef, type RefObject } from 'react';
import { toast } from 'sonner';

import { handleApiError } from '@/lib/handleApiError';
import { entryService, wizardService } from '@/services';
import { ApiError } from '@/services/api/apiClient';
import type { Evaluation, PromptEntry } from '@/types';

export interface ConflictState {
  localEntry: PromptEntry;
  serverEntry: PromptEntry;
}

interface UseEditorMutationsOptions {
  entryId: string | undefined;
  localEntryRef: RefObject<PromptEntry | null>;
  pendingEvaluationRef: RefObject<Evaluation | null>;
  onSaveSuccess: () => void;
  onPublishSuccess: () => void;
  handleChange: (updated: Partial<PromptEntry>, options?: { force?: boolean }) => void;
}

export function useEditorMutations({
  entryId,
  localEntryRef,
  pendingEvaluationRef,
  onSaveSuccess,
  onPublishSuccess,
  handleChange,
}: UseEditorMutationsOptions) {
  const queryClient = useQueryClient();
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  const saveMutation = useMutation({
    mutationFn: (data: PromptEntry) => {
      const evaluation = pendingEvaluationRef.current;
      return entryService.updateEntry(
        data.id,
        data,
        evaluation ? { evaluation: evaluation.dimensions } : undefined
      );
    },
    onSuccess: () => {
      onSaveSuccess();
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      toast.success('Draft saved');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 409 && err.code === 'CONCURRENCY_CONFLICT') {
        const serverData = err.details;
        if (serverData && localEntryRef.current) {
          const local = localEntryRef.current;
          const serverEntry = {
            ...local,
            title: (serverData.title as string) ?? local.title,
            systemMessage: (serverData.systemMessage as string | null) ?? null,
            prompts: Array.isArray(serverData.prompts)
              ? (serverData.prompts as Array<{ id: string; content: string; order: number }>)
              : local.prompts,
            version: (serverData.version as number) ?? local.version,
            versionState: (serverData.versionState as PromptEntry['versionState']) ?? local.versionState,
            rowVersion: (serverData.rowVersion as number) ?? local.rowVersion,
          } as PromptEntry;

          // Auto-resolve if content is identical (metadata-only conflict)
          const contentSame =
            local.title === serverEntry.title &&
            (local.systemMessage ?? '') === (serverEntry.systemMessage ?? '') &&
            local.prompts.length === serverEntry.prompts.length &&
            local.prompts.every((p, i) => p.content === serverEntry.prompts[i]?.content);

          if (contentSame) {
            queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
            toast.info('Conflict auto-resolved — no content changes');
            return;
          }

          setConflictState({ localEntry: local, serverEntry });
          return;
        }
      }
      handleApiError(err, { title: 'Failed to save' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => entryService.publishEntry(entryId!),
    onSuccess: () => {
      onPublishSuccess();
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Entry published');
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to publish' }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ folderId }: { folderId: string | null }) =>
      entryService.moveEntry(entryId!, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Entry moved');
    },
  });

  const handleSave = useCallback(() => {
    if (localEntryRef.current) {
      saveMutation.mutate(localEntryRef.current);
    }
  }, [saveMutation, localEntryRef]);

  const handlePublish = useCallback(() => {
    publishMutation.mutate();
  }, [publishMutation]);

  // AI actions with AbortController support
  const [isGeneratingSystemMessage, setIsGeneratingSystemMessage] = useState(false);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const aiAbortControllerRef = useRef<AbortController | null>(null);

  const handleCancelAiOperation = useCallback(() => {
    aiAbortControllerRef.current?.abort();
    aiAbortControllerRef.current = null;
    setIsGeneratingSystemMessage(false);
    setIsDecomposing(false);
    toast.info('AI operation cancelled');
  }, []);

  const handleGenerateSystemMessage = useCallback(async () => {
    if (!entryId || !localEntryRef.current?.prompts[0]?.content) return;
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;
    setIsGeneratingSystemMessage(true);
    try {
      const result = await wizardService.generateSystemMessage(entryId, {
        signal: controller.signal,
      });
      handleChange({ systemMessage: result }, { force: true });
      toast.success('System message generated');
    } catch (err) {
      if (controller.signal.aborted) return;
      handleApiError(err, { title: 'Failed to generate system message' });
    } finally {
      aiAbortControllerRef.current = null;
      setIsGeneratingSystemMessage(false);
    }
  }, [entryId, handleChange, localEntryRef]);

  const handleDecomposeToChain = useCallback(async () => {
    if (!entryId || !localEntryRef.current?.prompts[0]) return;
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;
    setIsDecomposing(true);
    try {
      const result = await wizardService.decomposeToChain(entryId, {
        signal: controller.signal,
      });
      handleChange({ prompts: result }, { force: true });
      toast.success(`Prompt decomposed into ${result.length} steps`);
    } catch (err) {
      if (controller.signal.aborted) return;
      handleApiError(err, { title: 'Failed to decompose prompt' });
    } finally {
      aiAbortControllerRef.current = null;
      setIsDecomposing(false);
    }
  }, [entryId, handleChange, localEntryRef]);

  const handleResolveConflict = useCallback(
    (resolved: Partial<PromptEntry>) => {
      // Include the server's rowVersion so the next save won't trigger another conflict
      if (conflictState?.serverEntry.rowVersion != null) {
        resolved.rowVersion = conflictState.serverEntry.rowVersion;
      }
      handleChange(resolved, { force: true });
      setConflictState(null);
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      toast.success('Conflict resolved — changes merged');
    },
    [handleChange, queryClient, entryId, conflictState]
  );

  const handleDismissConflict = useCallback(() => {
    setConflictState(null);
  }, []);

  return {
    saveMutation,
    publishMutation,
    moveMutation,
    handleSave,
    handlePublish,
    isGeneratingSystemMessage,
    handleGenerateSystemMessage,
    isDecomposing,
    handleDecomposeToChain,
    handleCancelAiOperation,
    conflictState,
    handleResolveConflict,
    handleDismissConflict,
  };
}
