import type { EnrichedModel } from '@/services/api/playgroundService';

// ── Grouped prop interfaces for PlaygroundToolbar ──

export interface PlaygroundModelState {
  selectedModel: EnrichedModel | null;
  model: string;
  modelsByProvider: Record<string, EnrichedModel[]>;
  modelsError: boolean;
  temperature: number;
  setTemperature: (v: number) => void;
  maxTokens: number;
  setMaxTokens: (v: number) => void;
  reasoningEffort: string;
  setReasoningEffort: (v: string) => void;
  showReasoning: boolean;
  setShowReasoning: (v: boolean) => void;
  onModelChange: (model: EnrichedModel) => void;
}

export interface PlaygroundRunState {
  isStreaming: boolean;
  hasValidationErrors: boolean;
  handleRun: () => void;
  handleAbort: () => void;
  onEnqueue: () => void;
  queueLength: number;
  isBatchRunning?: boolean;
  batchCurrent?: number;
  batchTotal?: number;
}

export interface PlaygroundToolState {
  enabledServerIds: string[];
  setEnabledServerIds: (v: string[]) => void;
  excludedToolNames: string[];
  setExcludedToolNames: (v: string[]) => void;
}

/** A queued model with a full snapshot of its parameters at enqueue time. */
export interface QueuedModel {
  model: EnrichedModel;
  temperature: number;
  maxTokens: number;
  reasoningEffort: string;
  showReasoning: boolean;
  isReasoning: boolean;
}

export function safeSessionGet<T>(key: string, fallback: T): T {
  try {
    const val = sessionStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

/** Add a run to the pinned list if not already present (by id). */
export function addPinToList<T extends { id: string }>(pins: T[], run: T): T[] {
  return pins.some((r) => r.id === run.id) ? pins : [...pins, run];
}

/** Remove a run from the pinned list by id. */
export function removePinFromList<T extends { id: string }>(pins: T[], runId: string): T[] {
  return pins.filter((r) => r.id !== runId);
}
