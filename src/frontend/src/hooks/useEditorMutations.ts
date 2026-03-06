import { useState, useCallback, type RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleApiError } from "@/lib/handleApiError";

import type { PromptEntry } from "@/types";
import { entryService, wizardService } from "@/services";

interface UseEditorMutationsOptions {
  entryId: string | undefined;
  localEntryRef: RefObject<PromptEntry | null>;
  onSaveSuccess: () => void;
  onPublishSuccess: () => void;
  handleChange: (updated: Partial<PromptEntry>, options?: { force?: boolean }) => void;
}

export function useEditorMutations({
  entryId,
  localEntryRef,
  onSaveSuccess,
  onPublishSuccess,
  handleChange,
}: UseEditorMutationsOptions) {
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (data: PromptEntry) =>
      entryService.updateEntry(data.id, data),
    onSuccess: () => {
      onSaveSuccess();
      queryClient.invalidateQueries({ queryKey: ["entry", entryId] });
      queryClient.invalidateQueries({ queryKey: ["versions", entryId] });
      toast.success("Draft saved");
    },
    onError: (err: unknown) => handleApiError(err, { title: "Failed to save" }),
  });

  const publishMutation = useMutation({
    mutationFn: () => entryService.publishEntry(entryId!),
    onSuccess: () => {
      onPublishSuccess();
      queryClient.invalidateQueries({ queryKey: ["entry", entryId] });
      queryClient.invalidateQueries({ queryKey: ["versions", entryId] });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      toast.success("Entry published");
    },
    onError: (err: unknown) => handleApiError(err, { title: "Failed to publish" }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ folderId }: { folderId: string | null }) =>
      entryService.moveEntry(entryId!, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry", entryId] });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      toast.success("Entry moved");
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

  // AI actions
  const [isGeneratingSystemMessage, setIsGeneratingSystemMessage] = useState(false);
  const [isDecomposing, setIsDecomposing] = useState(false);

  const handleGenerateSystemMessage = useCallback(async () => {
    if (!entryId || !localEntryRef.current?.prompts[0]?.content) return;
    setIsGeneratingSystemMessage(true);
    try {
      const result = await wizardService.generateSystemMessage(entryId);
      handleChange({ systemMessage: result }, { force: true });
      toast.success("System message generated");
    } catch (err) {
      handleApiError(err, { title: "Failed to generate system message" });
    } finally {
      setIsGeneratingSystemMessage(false);
    }
  }, [entryId, handleChange, localEntryRef]);

  const handleDecomposeToChain = useCallback(async () => {
    if (!entryId || !localEntryRef.current?.prompts[0]) return;
    setIsDecomposing(true);
    try {
      const result = await wizardService.decomposeToChain(entryId);
      handleChange({ prompts: result }, { force: true });
      toast.success(`Prompt decomposed into ${result.length} steps`);
    } catch (err) {
      handleApiError(err, { title: "Failed to decompose prompt" });
    } finally {
      setIsDecomposing(false);
    }
  }, [entryId, handleChange, localEntryRef]);

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
  };
}
