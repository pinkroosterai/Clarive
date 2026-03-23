import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { handleApiError } from '@/lib/handleApiError';
import { entryService, wizardService } from '@/services';
import type { Evaluation, PromptEntry } from '@/types';

export function useEvaluation(
  entryId: string | undefined,
  localEntryRef: React.RefObject<PromptEntry | null>
) {
  const queryClient = useQueryClient();
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [pendingEvaluation, setPendingEvaluation] = useState<Evaluation | null>(null);
  const pendingEvaluationRef = useRef<Evaluation | null>(null);
  pendingEvaluationRef.current = pendingEvaluation;

  const handleEvaluate = useCallback(async () => {
    const entry = localEntryRef.current;
    if (!entry || !entryId || entry.prompts.length === 0) return;
    setIsEvaluating(true);
    try {
      const result = await wizardService.evaluateEntry(
        entry.systemMessage,
        entry.prompts.map((p, i) => ({ content: p.content, sortOrder: i })),
        entry.title || undefined
      );
      setPendingEvaluation(result);

      // Persist evaluation immediately (don't wait for content save)
      await entryService.updateEntry(entryId, {}, { evaluation: result.dimensions });
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      setPendingEvaluation(null);

      toast.success('Evaluation complete');
    } catch (err) {
      handleApiError(err, { title: 'Evaluation failed' });
    } finally {
      setIsEvaluating(false);
    }
  }, [localEntryRef, entryId, queryClient]);

  return {
    isEvaluating,
    pendingEvaluation,
    pendingEvaluationRef,
    handleEvaluate,
    clearPendingEvaluation: () => setPendingEvaluation(null),
  };
}
