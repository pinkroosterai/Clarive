import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { addPinToList, removePinFromList } from '@/components/playground/utils';
import type { TestRunResponse } from '@/services/api/playgroundService';

export function usePlaygroundComparison() {
  const [showHistory, setShowHistory] = useState(
    () => window.matchMedia('(min-width: 768px)').matches
  );
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [pinnedRuns, setPinnedRuns] = useState<TestRunResponse[]>([]);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(-1);

  const addPin = useCallback((run: TestRunResponse) => {
    setPinnedRuns((prev) => addPinToList(prev, run));
  }, []);

  const removePin = useCallback((runId: string) => {
    setPinnedRuns((prev) => removePinFromList(prev, runId));
  }, []);

  const togglePin = useCallback((run: TestRunResponse) => {
    setPinnedRuns((prev) =>
      prev.some((r) => r.id === run.id)
        ? removePinFromList(prev, run.id)
        : addPinToList(prev, run)
    );
  }, []);

  const clearAllPins = useCallback(() => setPinnedRuns([]), []);

  // Reset carousel index when pins change + notify when all cleared
  const prevPinCountRef = useRef(0);
  useEffect(() => {
    setActiveCarouselIndex(-1);
    if (prevPinCountRef.current > 0 && pinnedRuns.length === 0) {
      toast.info('Comparison cleared');
    }
    prevPinCountRef.current = pinnedRuns.length;
  }, [pinnedRuns.length]);

  return {
    showHistory,
    setShowHistory,
    expandedRunId,
    setExpandedRunId,
    pinnedRuns,
    activeCarouselIndex,
    setActiveCarouselIndex,
    addPin,
    removePin,
    togglePin,
    clearAllPins,
  };
}
