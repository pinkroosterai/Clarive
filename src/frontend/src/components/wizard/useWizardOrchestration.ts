import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { GenerateOptions } from './DescribeStep';
import { handleWizardError, wizardReducer } from './wizardReducer';

import { handleApiError } from '@/lib/handleApiError';
import { entryService, wizardService } from '@/services';
import { ApiError } from '@/services/api/apiClient';
import type { ProgressEvent, PromptEntry } from '@/types';

// ── Hook ──

export function useWizardOrchestration(
  mode: 'new' | 'enhance',
  existingEntry: PromptEntry | undefined,
  onClose: () => void
) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const startStep = mode === 'enhance' ? 2 : 1;
  const totalSteps = mode === 'enhance' ? 2 : 3;

  const [state, dispatch] = useReducer(wizardReducer, {
    step: startStep,
    sessionId: null,
    draft: mode === 'enhance' && existingEntry ? structuredClone(existingEntry) : null,
    questions: [],
    enhancements: [],
    evaluation: undefined,
    scoreHistory: undefined,
    isGenerating: false,
    generatingOperation: null,
    currentStage: null,
    progressLog: [],
    confirmDiscardOpen: false,
    bootstrapState: mode === 'enhance' ? 'loading' : 'ready',
  });

  // --- Progress event handler ---
  const handleProgress = useCallback((event: ProgressEvent) => {
    if (event.type === 'stage') {
      dispatch({ type: 'PROGRESS_STAGE', event });
    } else if (event.type === 'tool_start') {
      dispatch({ type: 'PROGRESS_TOOL_START', event });
    } else if (event.type === 'tool_end') {
      dispatch({ type: 'PROGRESS_TOOL_END', event });
    }
  }, []);

  // --- Bootstrap enhance mode ---
  const existingEntryId = existingEntry?.id;
  const runBootstrap = useCallback(() => {
    if (!existingEntryId) return;
    dispatch({ type: 'SET_BOOTSTRAP', state: 'loading' });
    dispatch({ type: 'START_GENERATING', operation: 'enhance' });
    wizardService
      .enhanceEntry(existingEntryId, handleProgress)
      .then((result) => {
        dispatch({ type: 'APPLY_RESULT', payload: result });
        dispatch({ type: 'SET_BOOTSTRAP', state: 'ready' });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          toast.error('Please verify your email to use AI features.');
        } else {
          handleApiError(err, { silent: true });
          dispatch({ type: 'SET_BOOTSTRAP', state: 'error' });
        }
      })
      .finally(() => {
        dispatch({ type: 'STOP_GENERATING' });
      });
  }, [existingEntryId, handleProgress]);

  useEffect(() => {
    if (mode !== 'enhance' || !existingEntryId) return;
    runBootstrap();
  }, [mode, existingEntryId, runBootstrap]);

  // --- Warn before closing tab with draft ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.draft) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.draft]);

  // --- Step 1: Describe -> generate directly ---
  const handleDescribe = useCallback(
    async (description: string, options: GenerateOptions) => {
      dispatch({ type: 'START_GENERATING', operation: 'generate' });
      try {
        const result = await wizardService.generatePrompt(
          description,
          {
            generateSystemMessage: options.generateSystemMessage,
            generateTemplate: options.generateAsTemplate,
            generateChain: options.generateAsChain,
            toolIds: options.selectedToolIds,
            enableWebSearch: options.enableWebSearch,
          },
          handleProgress
        );
        dispatch({ type: 'APPLY_RESULT', payload: result });
        dispatch({ type: 'SET_STEP', step: 2 });
      } catch (err) {
        handleWizardError(err, 'Generation failed');
      } finally {
        dispatch({ type: 'STOP_GENERATING' });
      }
    },
    [handleProgress]
  );

  // --- Step 2: Refine ---
  const handleRefine = useCallback(
    async (answers: string[], selectedEnhancementNames: string[]) => {
      if (!state.draft || !state.sessionId) return;
      dispatch({ type: 'START_GENERATING', operation: 'refine' });
      try {
        const structuredAnswers = answers.map((answer, i) => ({
          questionIndex: i,
          answer,
        }));
        const enhancementIndices = selectedEnhancementNames
          .map((name) => state.enhancements.indexOf(name))
          .filter((i) => i >= 0);
        const result = await wizardService.refinePrompt(
          state.sessionId,
          structuredAnswers,
          enhancementIndices,
          handleProgress
        );
        dispatch({ type: 'APPLY_RESULT', payload: result });
      } catch (err) {
        if (err instanceof ApiError && err.status === 410) {
          toast.error('Session expired. Please start a new generation.');
        } else {
          handleWizardError(err, 'Refinement failed');
        }
      } finally {
        dispatch({ type: 'STOP_GENERATING' });
      }
    },
    [state.draft, state.sessionId, state.enhancements, handleProgress]
  );

  // --- Save ---
  const saveMutation = useMutation({
    mutationFn: async (folderId: string | null) => {
      if (!state.draft) throw new Error('No draft');
      const evaluationDims = state.evaluation?.dimensions ?? null;

      if (mode === 'new') {
        const created = await entryService.createEntry({ ...state.draft, folderId });
        // Persist evaluation on the newly created entry
        if (evaluationDims) {
          return entryService.updateEntry(created.id, {}, { evaluation: evaluationDims });
        }
        return created;
      } else {
        return entryService.updateEntry(
          existingEntry!.id,
          {
            title: state.draft.title,
            systemMessage: state.draft.systemMessage,
            prompts: state.draft.prompts,
          },
          evaluationDims ? { evaluation: evaluationDims } : undefined
        );
      }
    },
    onSuccess: (result) => {
      if (mode === 'new') {
        toast.success('Entry created');
        queryClient.invalidateQueries({ queryKey: ['entries'] });
        navigate(`/entry/${result.id}`);
      } else {
        toast.success('Entry enhanced');
        queryClient.invalidateQueries({
          queryKey: ['entry', existingEntry?.id],
        });
        navigate(`/entry/${existingEntry!.id}`);
      }
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Save failed' }),
  });

  // --- Close handling ---
  const requestClose = useCallback(() => {
    if (state.draft || state.isGenerating || state.sessionId) {
      dispatch({ type: 'SET_CONFIRM_DISCARD', open: true });
    } else {
      onClose();
    }
  }, [state.draft, state.isGenerating, state.sessionId, onClose]);

  const confirmDiscard = useCallback(() => {
    dispatch({ type: 'SET_CONFIRM_DISCARD', open: false });
    onClose();
  }, [onClose]);

  // --- Step progress ---
  const displayStep = mode === 'enhance' ? state.step - 1 : state.step;
  const stepLabels = mode === 'new' ? ['Describe', 'Review', 'Save'] : ['Review', 'Save'];
  const prevStepRef = useRef(displayStep);
  const direction = displayStep >= prevStepRef.current ? 'forward' : 'backward';
  useEffect(() => {
    prevStepRef.current = displayStep;
  }, [displayStep]);

  const stepHint = (() => {
    switch (state.step) {
      case 1:
        return 'Describe what you want to generate';
      case 2:
        return 'Review the generated draft and optionally refine it';
      case 3:
        return 'Save your prompt entry';
      default:
        return '';
    }
  })();

  return {
    // Step navigation
    step: state.step,
    setStep: (step: number) => dispatch({ type: 'SET_STEP', step }),
    startStep,
    totalSteps,
    displayStep,
    stepLabels,
    direction,
    stepHint,

    // State
    draft: state.draft,
    questions: state.questions,
    enhancements: state.enhancements,
    evaluation: state.evaluation,
    scoreHistory: state.scoreHistory,
    isGenerating: state.isGenerating,
    generatingOperation: state.generatingOperation,
    currentStage: state.currentStage,
    progressLog: state.progressLog,
    bootstrapState: state.bootstrapState,

    // Dialogs
    confirmDiscardOpen: state.confirmDiscardOpen,
    setConfirmDiscardOpen: (open: boolean) => dispatch({ type: 'SET_CONFIRM_DISCARD', open }),

    // Handlers
    handleDescribe,
    handleRefine,
    requestClose,
    confirmDiscard,
    runBootstrap,

    // Save
    saveMutation,
  };
}
