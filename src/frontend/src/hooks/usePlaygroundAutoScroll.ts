import { useEffect, useRef } from 'react';

import type { StreamSegment } from './usePlaygroundStreaming';

/**
 * Auto-follows page scroll to bottom during streaming.
 * Disengages when the user manually scrolls up, re-engages when they scroll
 * back near the bottom. Uses requestAnimationFrame to avoid layout thrashing.
 */
export function usePlaygroundAutoScroll(isStreaming: boolean, segments: StreamSegment[]) {
  const isAutoFollowRef = useRef(true);
  const scrollRafRef = useRef<number | null>(null);

  // Track user scroll position to disengage auto-follow
  useEffect(() => {
    const handleScroll = () => {
      if (!isStreaming) return;
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      isAutoFollowRef.current = isNearBottom;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isStreaming]);

  // Scroll to bottom when new segments arrive (if auto-following)
  useEffect(() => {
    if (!isStreaming || !isAutoFollowRef.current) return;
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
      scrollRafRef.current = null;
    });
  }, [segments, isStreaming]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  // Reset auto-follow when a new run starts
  const resetAutoFollow = () => {
    isAutoFollowRef.current = true;
  };

  return { resetAutoFollow };
}
