import { useState, useCallback, useEffect } from 'react';

import type { QueuedModel } from '@/components/playground/utils';
import { PLAYGROUND_DEFAULTS } from '@/lib/constants';
import type { EnrichedModel } from '@/services/api/playgroundService';

export function usePlaygroundModelSelection(enrichedModels: EnrichedModel[]) {
  const [selectedModel, setSelectedModel] = useState<EnrichedModel | null>(null);
  const [temperature, setTemperature] = useState(PLAYGROUND_DEFAULTS.TEMPERATURE);
  const [maxTokens, setMaxTokens] = useState(PLAYGROUND_DEFAULTS.MAX_TOKENS);
  const [reasoningEffort, setReasoningEffort] = useState(PLAYGROUND_DEFAULTS.REASONING_EFFORT);
  const [showReasoning, setShowReasoning] = useState(true);

  // Auto-select first model when models load
  useEffect(() => {
    if (enrichedModels.length > 0 && !selectedModel) {
      const first = enrichedModels[0];
      setSelectedModel(first);
      setTemperature(first.defaultTemperature ?? PLAYGROUND_DEFAULTS.TEMPERATURE);
      setMaxTokens(first.defaultMaxTokens ?? PLAYGROUND_DEFAULTS.MAX_TOKENS);
      setReasoningEffort(first.defaultReasoningEffort ?? PLAYGROUND_DEFAULTS.REASONING_EFFORT);
    }
  }, [enrichedModels, selectedModel]);

  const applyModelParameters = useCallback((item: QueuedModel) => {
    setSelectedModel(item.model);
    setTemperature(item.temperature);
    setMaxTokens(item.maxTokens);
    setReasoningEffort(item.reasoningEffort);
    setShowReasoning(item.showReasoning);
  }, []);

  const handleModelChange = useCallback((found: EnrichedModel) => {
    setSelectedModel(found);
    setTemperature(found.defaultTemperature ?? PLAYGROUND_DEFAULTS.TEMPERATURE);
    setMaxTokens(found.defaultMaxTokens ?? PLAYGROUND_DEFAULTS.MAX_TOKENS);
    setReasoningEffort(found.defaultReasoningEffort ?? PLAYGROUND_DEFAULTS.REASONING_EFFORT);
  }, []);

  return {
    selectedModel,
    setSelectedModel,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    reasoningEffort,
    setReasoningEffort,
    showReasoning,
    setShowReasoning,
    applyModelParameters,
    handleModelChange,
  };
}
