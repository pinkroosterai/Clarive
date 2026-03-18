import { useEffect, useRef } from 'react';

interface UsePlaygroundKeyboardShortcutsOptions {
  isStreaming: boolean;
  canRun: boolean;
  onRun: () => void;
  onAbort: () => void;
}

export function usePlaygroundKeyboardShortcuts({
  isStreaming,
  canRun,
  onRun,
  onAbort,
}: UsePlaygroundKeyboardShortcutsOptions) {
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const onAbortRef = useRef(onAbort);
  onAbortRef.current = onAbort;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault();
        onAbortRef.current();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'TEXTAREA') return;
        if (!isStreaming && canRun) {
          e.preventDefault();
          onRunRef.current();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isStreaming, canRun]);
}
