import { useCallback, useRef, useState } from 'react';

import type { StreamSegment } from './streamingTypes';

/**
 * Manages streaming segment sync between a mutable ref (written to on every SSE chunk)
 * and React state (read by the UI at 100ms intervals). This avoids dispatching reducer
 * updates on every chunk while keeping the detail drawer visually up-to-date.
 */
export function useStreamSync() {
  const [activeStreamSegments, setActiveStreamSegments] = useState<StreamSegment[]>([]);
  const [activeStreamKey, setActiveStreamKey] = useState<string>('');

  const activeStreamRef = useRef<{ key: string; segments: StreamSegment[] }>({
    key: '',
    segments: [],
  });
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startStreamSync = useCallback((key: string) => {
    activeStreamRef.current = { key, segments: [] };
    setActiveStreamKey(key);
    setActiveStreamSegments([]);

    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      if (activeStreamRef.current.key === key) {
        setActiveStreamSegments([...activeStreamRef.current.segments]);
      }
    }, 100);
  }, []);

  const stopStreamSync = useCallback(() => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    // Final sync
    setActiveStreamSegments([...activeStreamRef.current.segments]);
  }, []);

  return {
    activeStreamSegments,
    activeStreamKey,
    activeStreamRef,
    syncTimerRef,
    startStreamSync,
    stopStreamSync,
  };
}
