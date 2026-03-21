import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import type { QueuedModel } from '@/components/playground/utils';
import type { EnrichedModel } from '@/services/api/playgroundService';

interface QueueManagerParams {
  selectedModel: EnrichedModel | null;
  temperature: number;
  maxTokens: number;
  reasoningEffort: string;
  showReasoning: boolean;
}

/**
 * Manages the user-facing queue for building multi-model comparisons.
 * This is the pre-execution queue — items are moved to the batch
 * orchestration hook's execution queue when the user clicks "Run Queue".
 */
export function usePlaygroundQueueManager({
  selectedModel,
  temperature,
  maxTokens,
  reasoningEffort,
  showReasoning,
}: QueueManagerParams) {
  const [queuedModels, setQueuedModels] = useState<QueuedModel[]>([]);

  const handleEnqueue = useCallback(() => {
    if (!selectedModel) return;
    setQueuedModels((prev) => [
      ...prev,
      {
        model: selectedModel,
        temperature,
        maxTokens,
        reasoningEffort,
        showReasoning,
        isReasoning: selectedModel.isReasoning,
      },
    ]);
    toast.success(`Enqueued ${selectedModel.displayName || selectedModel.modelId}`);
  }, [selectedModel, temperature, maxTokens, reasoningEffort, showReasoning]);

  const handleRemoveFromQueue = useCallback((index: number) => {
    setQueuedModels((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearQueue = useCallback(() => {
    setQueuedModels([]);
  }, []);

  return {
    queuedModels,
    setQueuedModels,
    handleEnqueue,
    handleRemoveFromQueue,
    handleClearQueue,
  };
}
