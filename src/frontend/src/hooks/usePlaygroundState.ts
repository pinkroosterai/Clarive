import { useMemo } from 'react';

import type {
  PlaygroundModelState,
  PlaygroundRunState,
  PlaygroundToolState,
  PlaygroundStreamingState,
  PlaygroundComparisonState,
  PlaygroundTemplateState,
  PlaygroundJudgeState,
} from '@/components/playground/utils';
import type { usePlaygroundStreaming } from '@/hooks/usePlaygroundStreaming';
import type { EnrichedModel, Evaluation } from '@/services/api/playgroundService';
import type { TemplateField } from '@/types';

interface UsePlaygroundStateInput {
  // Model selection
  selectedModel: EnrichedModel | null;
  model: string;
  enrichedModels: EnrichedModel[];
  modelsError: boolean;
  temperature: number;
  setTemperature: (v: number) => void;
  maxTokens: number;
  setMaxTokens: (v: number) => void;
  reasoningEffort: string;
  setReasoningEffort: (v: string) => void;
  showReasoning: boolean;
  setShowReasoning: (v: boolean) => void;
  handleModelChange: (model: EnrichedModel) => void;

  // Run state
  hasValidationErrors: boolean;
  handleRun: () => void;
  handleAbort: () => void;
  handleBatchAbort: () => void;
  handleEnqueue: () => void;
  queueLength: number;
  isBatchRunning: boolean;
  batchCurrent: number;
  batchTotal: number;

  // Tool state
  tools: ReturnType<typeof import('@/hooks/usePlaygroundTools').usePlaygroundTools>;

  // Streaming
  streaming: ReturnType<typeof usePlaygroundStreaming>;

  // Comparison
  pinnedRuns: import('@/services/api/playgroundService').TestRunResponse[];
  removePin: (runId: string) => void;
  clearAllPins: () => void;
  activeCarouselIndex: number;
  setActiveCarouselIndex: React.Dispatch<React.SetStateAction<number>>;
  clearCurrentRun: () => void;

  // Template
  templateFields: TemplateField[];
  fieldValues: Record<string, string>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleFillTemplateFields?: () => void;
  isFillingTemplateFields: boolean;

  // Judge
  lastJudgeScores: Evaluation | null;
  isJudging: boolean;
}

interface UsePlaygroundStateReturn {
  modelState: PlaygroundModelState;
  runState: PlaygroundRunState;
  toolState: PlaygroundToolState;
  streamingState: PlaygroundStreamingState;
  comparisonState: PlaygroundComparisonState;
  templateState: PlaygroundTemplateState;
  judgeState: PlaygroundJudgeState;
}

export function usePlaygroundState(input: UsePlaygroundStateInput): UsePlaygroundStateReturn {
  const modelsByProvider = useMemo(
    () =>
      input.enrichedModels.reduce<Record<string, EnrichedModel[]>>((acc, m) => {
        (acc[m.providerName] ??= []).push(m);
        return acc;
      }, {}),
    [input.enrichedModels]
  );

  const modelState = useMemo<PlaygroundModelState>(
    () => ({
      selectedModel: input.selectedModel,
      model: input.model,
      modelsByProvider,
      modelsError: input.modelsError,
      temperature: input.temperature,
      setTemperature: input.setTemperature,
      maxTokens: input.maxTokens,
      setMaxTokens: input.setMaxTokens,
      reasoningEffort: input.reasoningEffort,
      setReasoningEffort: input.setReasoningEffort,
      showReasoning: input.showReasoning,
      setShowReasoning: input.setShowReasoning,
      onModelChange: input.handleModelChange,
    }),
    [
      input.selectedModel,
      input.model,
      modelsByProvider,
      input.modelsError,
      input.temperature,
      input.setTemperature,
      input.maxTokens,
      input.setMaxTokens,
      input.reasoningEffort,
      input.setReasoningEffort,
      input.showReasoning,
      input.setShowReasoning,
      input.handleModelChange,
    ]
  );

  const runState = useMemo<PlaygroundRunState>(
    () => ({
      isStreaming: input.streaming.isStreaming,
      hasValidationErrors: input.hasValidationErrors,
      handleRun: input.handleRun,
      handleAbort: input.isBatchRunning ? input.handleBatchAbort : input.handleAbort,
      onEnqueue: input.handleEnqueue,
      queueLength: input.queueLength,
      isBatchRunning: input.isBatchRunning,
      batchCurrent: input.batchCurrent,
      batchTotal: input.batchTotal,
    }),
    [
      input.streaming.isStreaming,
      input.hasValidationErrors,
      input.handleRun,
      input.handleAbort,
      input.isBatchRunning,
      input.handleBatchAbort,
      input.handleEnqueue,
      input.queueLength,
      input.batchCurrent,
      input.batchTotal,
    ]
  );

  const toolState = useMemo<PlaygroundToolState>(
    () => ({
      enabledServerIds: input.tools.enabledServerIds,
      setEnabledServerIds: input.tools.setEnabledServerIds,
      excludedToolNames: input.tools.excludedToolNames,
      setExcludedToolNames: input.tools.setExcludedToolNames,
      mcpServers: input.tools.mcpServers,
      allTools: input.tools.allTools,
    }),
    [
      input.tools.enabledServerIds,
      input.tools.setEnabledServerIds,
      input.tools.excludedToolNames,
      input.tools.setExcludedToolNames,
      input.tools.mcpServers,
      input.tools.allTools,
    ]
  );

  const streamingState = useMemo<PlaygroundStreamingState>(
    () => ({
      isStreaming: input.streaming.isStreaming,
      firstTokenReceived: input.streaming.firstTokenReceived,
      segments: input.streaming.segments,
      error: input.streaming.error,
      wasStopped: input.streaming.wasStopped,
      rateLimitCountdown: input.streaming.rateLimitCountdown,
      elapsedSeconds: input.streaming.elapsedSeconds,
      approxOutputTokens: input.streaming.approxOutputTokens,
      lastTokens: input.streaming.lastTokens,
      hasResponses: input.streaming.hasResponses,
      responseCount: input.streaming.responseCount,
      responseAreaRef: input.streaming.responseAreaRef,
    }),
    [
      input.streaming.isStreaming,
      input.streaming.firstTokenReceived,
      input.streaming.segments,
      input.streaming.error,
      input.streaming.wasStopped,
      input.streaming.rateLimitCountdown,
      input.streaming.elapsedSeconds,
      input.streaming.approxOutputTokens,
      input.streaming.lastTokens,
      input.streaming.hasResponses,
      input.streaming.responseCount,
      input.streaming.responseAreaRef,
    ]
  );

  const comparisonState = useMemo<PlaygroundComparisonState>(
    () => ({
      pinnedRuns: input.pinnedRuns,
      onUnpin: input.removePin,
      onClearAllPins: input.clearAllPins,
      activeCarouselIndex: input.activeCarouselIndex,
      setActiveCarouselIndex: input.setActiveCarouselIndex,
      onClearCurrentRun: input.clearCurrentRun,
    }),
    [
      input.pinnedRuns,
      input.removePin,
      input.clearAllPins,
      input.activeCarouselIndex,
      input.setActiveCarouselIndex,
      input.clearCurrentRun,
    ]
  );

  const templateState = useMemo<PlaygroundTemplateState>(
    () => ({
      templateFields: input.templateFields,
      fieldValues: input.fieldValues,
      setFieldValues: input.setFieldValues,
      onFillTemplateFields:
        input.templateFields.length > 0 ? input.handleFillTemplateFields : undefined,
      isFillingTemplateFields: input.isFillingTemplateFields,
    }),
    [
      input.templateFields,
      input.fieldValues,
      input.setFieldValues,
      input.handleFillTemplateFields,
      input.isFillingTemplateFields,
    ]
  );

  const judgeState = useMemo<PlaygroundJudgeState>(
    () => ({ currentJudgeScores: input.lastJudgeScores, isJudging: input.isJudging }),
    [input.lastJudgeScores, input.isJudging]
  );

  return {
    modelState,
    runState,
    toolState,
    streamingState,
    comparisonState,
    templateState,
    judgeState,
  };
}
