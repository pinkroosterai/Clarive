import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { GenerateOptions } from './DescribeStep';
import type { GeneratingOperation } from './WizardLoadingOverlay';

import { handleApiError } from '@/lib/handleApiError';
import { entryService, wizardService } from '@/services';
import { ApiError } from '@/services/api/apiClient';
import type {
  PromptEntry,
  ClarificationQuestion,
  Evaluation,
  IterationScore,
  ProgressEvent,
  ProgressLogEntry,
} from '@/types';

type BootstrapState = 'loading' | 'ready' | 'error';

function handleWizardError(err: unknown, fallbackTitle: string) {
  if (err instanceof ApiError && err.status === 403) {
    toast.error('Please verify your email to use AI features.');
    return 'handled' as const;
  } else {
    handleApiError(err, { title: fallbackTitle });
    return 'handled' as const;
  }
}

export function useWizardOrchestration(
  mode: 'new' | 'enhance',
  existingEntry: PromptEntry | undefined,
  onClose: () => void
) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const startStep = mode === 'enhance' ? 2 : 1;
  const totalSteps = mode === 'enhance' ? 2 : 3;

  const [step, setStep] = useState(startStep);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptEntry | null>(
    mode === 'enhance' && existingEntry ? structuredClone(existingEntry) : null
  );
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [enhancements, setEnhancements] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | undefined>();
  const [scoreHistory, setScoreHistory] = useState<IterationScore[] | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingOperation, setGeneratingOperation] = useState<GeneratingOperation | null>(null);
  const [currentStage, setCurrentStage] = useState<ProgressEvent | null>(null);
  const [progressLog, setProgressLog] = useState<ProgressLogEntry[]>([]);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>(
    mode === 'enhance' ? 'loading' : 'ready'
  );

  // --- Progress event handler ---
  const handleProgress = useCallback((event: ProgressEvent) => {
    if (event.type === 'stage') {
      setCurrentStage(event);
      setProgressLog((prev) => [
        ...prev,
        {
          id: event.id,
          icon: event.icon ?? '',
          message: event.message ?? '',
          detail: event.detail,
          completed: true,
          isStage: true,
          timestamp: Date.now(),
        },
      ]);
    } else if (event.type === 'tool_start') {
      setProgressLog((prev) => [
        ...prev,
        {
          id: event.id,
          icon: event.icon ?? '',
          message: event.message ?? '',
          detail: event.detail,
          completed: false,
          isStage: false,
          timestamp: Date.now(),
        },
      ]);
    } else if (event.type === 'tool_end') {
      setProgressLog((prev) =>
        prev.map((entry) => (entry.id === event.id ? { ...entry, completed: true } : entry))
      );
    }
  }, []);

  const resetProgress = useCallback(() => {
    setCurrentStage(null);
    setProgressLog([]);
  }, []);

  // --- Apply result helper ---
  const applyResult = useCallback(
    (result: {
      sessionId: string;
      draft: PromptEntry;
      questions: ClarificationQuestion[];
      enhancements: string[];
      evaluation?: Evaluation;
      scoreHistory?: IterationScore[];
    }) => {
      setSessionId(result.sessionId);
      setDraft(result.draft);
      setQuestions(result.questions);
      setEnhancements(result.enhancements);
      setEvaluation(result.evaluation);
      setScoreHistory(result.scoreHistory);
    },
    []
  );

  // --- Bootstrap enhance mode ---
  const existingEntryId = existingEntry?.id;
  const runBootstrap = useCallback(() => {
    if (!existingEntryId) return;
    setBootstrapState('loading');
    setIsGenerating(true);
    setGeneratingOperation('enhance');
    resetProgress();
    wizardService
      .enhanceEntry(existingEntryId, handleProgress)
      .then((result) => {
        applyResult(result);
        setBootstrapState('ready');
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          toast.error('Please verify your email to use AI features.');
        } else {
          handleApiError(err, { silent: true });
          setBootstrapState('error');
        }
      })
      .finally(() => {
        setIsGenerating(false);
        setGeneratingOperation(null);
        resetProgress();
      });
  }, [existingEntryId, applyResult, handleProgress, resetProgress]);

  useEffect(() => {
    if (mode !== 'enhance' || !existingEntryId) return;
    runBootstrap();
  }, [mode, existingEntryId, runBootstrap]);

  // --- Warn before closing tab with draft ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (draft) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [draft]);

  // --- Step 1: Describe -> generate directly ---
  const handleDescribe = useCallback(
    async (description: string, options: GenerateOptions) => {
      setIsGenerating(true);
      setGeneratingOperation('generate');
      resetProgress();
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
        applyResult(result);
        setStep(2);
      } catch (err) {
        handleWizardError(err, 'Generation failed');
      } finally {
        setIsGenerating(false);
        setGeneratingOperation(null);
        resetProgress();
      }
    },
    [applyResult, handleProgress, resetProgress]
  );

  // --- Step 2: Refine ---
  const handleRefine = useCallback(
    async (answers: string[], selectedEnhancementNames: string[]) => {
      if (!draft || !sessionId) return;
      setIsGenerating(true);
      setGeneratingOperation('refine');
      resetProgress();
      try {
        const structuredAnswers = answers.map((answer, i) => ({
          questionIndex: i,
          answer,
        }));
        const enhancementIndices = selectedEnhancementNames
          .map((name) => enhancements.indexOf(name))
          .filter((i) => i >= 0);
        const result = await wizardService.refinePrompt(
          sessionId,
          structuredAnswers,
          enhancementIndices,
          handleProgress
        );
        applyResult(result);
      } catch (err) {
        if (err instanceof ApiError && err.status === 410) {
          toast.error('Session expired. Please start a new generation.');
        } else {
          handleWizardError(err, 'Refinement failed');
        }
      } finally {
        setIsGenerating(false);
        setGeneratingOperation(null);
        resetProgress();
      }
    },
    [draft, sessionId, enhancements, applyResult, handleProgress, resetProgress]
  );

  // --- Save ---
  const saveMutation = useMutation({
    mutationFn: async (folderId: string | null) => {
      if (!draft) throw new Error('No draft');
      if (mode === 'new') {
        return entryService.createEntry({ ...draft, folderId });
      } else {
        return entryService.updateEntry(existingEntry!.id, {
          title: draft.title,
          systemMessage: draft.systemMessage,
          prompts: draft.prompts,
        });
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
    if (draft || isGenerating || sessionId) {
      setConfirmDiscardOpen(true);
    } else {
      onClose();
    }
  }, [draft, isGenerating, sessionId, onClose]);

  const confirmDiscard = useCallback(() => {
    setConfirmDiscardOpen(false);
    onClose();
  }, [onClose]);

  // --- Step progress ---
  const displayStep = mode === 'enhance' ? step - 1 : step;
  const stepLabels = mode === 'new' ? ['Describe', 'Review', 'Save'] : ['Review', 'Save'];
  const prevStepRef = useRef(displayStep);
  const direction = displayStep >= prevStepRef.current ? 'forward' : 'backward';
  useEffect(() => {
    prevStepRef.current = displayStep;
  }, [displayStep]);

  const stepHint = (() => {
    switch (step) {
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
    step,
    setStep,
    startStep,
    totalSteps,
    displayStep,
    stepLabels,
    direction,
    stepHint,

    // State
    draft,
    questions,
    enhancements,
    evaluation,
    scoreHistory,
    isGenerating,
    generatingOperation,
    currentStage,
    progressLog,
    bootstrapState,

    // Dialogs
    confirmDiscardOpen,
    setConfirmDiscardOpen,

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
