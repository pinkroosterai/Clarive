import { toast } from 'sonner';

import type { GeneratingOperation } from './WizardLoadingOverlay';

import { handleApiError } from '@/lib/handleApiError';
import { ApiError } from '@/services/api/apiClient';
import type {
  ClarificationQuestion,
  Evaluation,
  IterationScore,
  ProgressEvent,
  ProgressLogEntry,
  PromptEntry,
} from '@/types';

export type BootstrapState = 'loading' | 'ready' | 'error';

// ── Reducer state & actions ──

export interface WizardState {
  step: number;
  sessionId: string | null;
  draft: PromptEntry | null;
  questions: ClarificationQuestion[];
  enhancements: string[];
  evaluation: Evaluation | undefined;
  scoreHistory: IterationScore[] | undefined;
  isGenerating: boolean;
  generatingOperation: GeneratingOperation | null;
  currentStage: ProgressEvent | null;
  progressLog: ProgressLogEntry[];
  confirmDiscardOpen: boolean;
  bootstrapState: BootstrapState;
}

export type WizardAction =
  | {
      type: 'APPLY_RESULT';
      payload: {
        sessionId: string;
        draft: PromptEntry;
        questions: ClarificationQuestion[];
        enhancements: string[];
        evaluation?: Evaluation;
        scoreHistory?: IterationScore[];
      };
    }
  | { type: 'SET_STEP'; step: number }
  | { type: 'START_GENERATING'; operation: GeneratingOperation }
  | { type: 'STOP_GENERATING' }
  | { type: 'RESET_PROGRESS' }
  | { type: 'PROGRESS_STAGE'; event: ProgressEvent }
  | { type: 'PROGRESS_TOOL_START'; event: ProgressEvent }
  | { type: 'PROGRESS_TOOL_END'; event: ProgressEvent }
  | { type: 'SET_BOOTSTRAP'; state: BootstrapState }
  | { type: 'SET_CONFIRM_DISCARD'; open: boolean };

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'APPLY_RESULT':
      return {
        ...state,
        sessionId: action.payload.sessionId,
        draft: action.payload.draft,
        questions: action.payload.questions,
        enhancements: action.payload.enhancements,
        evaluation: action.payload.evaluation,
        scoreHistory: action.payload.scoreHistory,
      };
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'START_GENERATING':
      return {
        ...state,
        isGenerating: true,
        generatingOperation: action.operation,
        currentStage: null,
        progressLog: [],
      };
    case 'STOP_GENERATING':
      return {
        ...state,
        isGenerating: false,
        generatingOperation: null,
        currentStage: null,
        progressLog: [],
      };
    case 'RESET_PROGRESS':
      return { ...state, currentStage: null, progressLog: [] };
    case 'PROGRESS_STAGE':
      return {
        ...state,
        currentStage: action.event,
        progressLog: [
          ...state.progressLog,
          {
            id: action.event.id,
            icon: action.event.icon ?? '',
            message: action.event.message ?? '',
            detail: action.event.detail,
            completed: true,
            isStage: true,
            timestamp: Date.now(),
          },
        ],
      };
    case 'PROGRESS_TOOL_START':
      return {
        ...state,
        progressLog: [
          ...state.progressLog,
          {
            id: action.event.id,
            icon: action.event.icon ?? '',
            message: action.event.message ?? '',
            detail: action.event.detail,
            completed: false,
            isStage: false,
            timestamp: Date.now(),
          },
        ],
      };
    case 'PROGRESS_TOOL_END':
      return {
        ...state,
        progressLog: state.progressLog.map((entry) =>
          entry.id === action.event.id ? { ...entry, completed: true } : entry
        ),
      };
    case 'SET_BOOTSTRAP':
      return { ...state, bootstrapState: action.state };
    case 'SET_CONFIRM_DISCARD':
      return { ...state, confirmDiscardOpen: action.open };
    default:
      return state;
  }
}

// ── Helper ──

export function handleWizardError(err: unknown, fallbackTitle: string) {
  if (err instanceof ApiError && err.status === 403) {
    toast.error('Please verify your email to use AI features.');
    return 'handled' as const;
  } else {
    handleApiError(err, { title: fallbackTitle });
    return 'handled' as const;
  }
}
