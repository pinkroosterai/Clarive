import type { EnrichedModel } from '@/services/api/playgroundService';
import type { TemplateField } from '@/types';

// ── Grouped prop interface for template variables ──

export interface PlaygroundTemplateState {
  templateFields: TemplateField[];
  fieldValues: Record<string, string>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onFillTemplateFields?: () => void;
  isFillingTemplateFields?: boolean;
}

// ── Queued model snapshot ──

/** A queued model with a full snapshot of its parameters at enqueue time. */
export interface QueuedModel {
  model: EnrichedModel;
  temperature: number;
  maxTokens: number;
  reasoningEffort: string;
  showReasoning: boolean;
  isReasoning: boolean;
}

// ── Utilities ──

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
