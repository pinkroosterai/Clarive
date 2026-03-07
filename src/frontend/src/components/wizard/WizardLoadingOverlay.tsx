import { AnimatePresence, motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

import { AiLoadingAnimation } from './AiLoadingAnimation';

import type { ProgressEvent, ProgressLogEntry } from '@/types';

export type GeneratingOperation = 'generate' | 'refine' | 'enhance';

interface WizardLoadingOverlayProps {
  operation: GeneratingOperation;
  currentStage?: ProgressEvent | null;
  progressLog: ProgressLogEntry[];
}

const FALLBACK_MESSAGES: Record<GeneratingOperation, string[]> = {
  generate: [
    'Analyzing your description\u2026',
    'Crafting your prompt\u2026',
    'Evaluating quality\u2026',
    'Polishing the result\u2026',
  ],
  refine: [
    'Applying your feedback\u2026',
    'Refining prompt\u2026',
    'Re-evaluating quality\u2026',
    'Polishing the result\u2026',
  ],
  enhance: [
    'Analyzing existing entry\u2026',
    'Identifying improvements\u2026',
    'Generating enhancements\u2026',
    'Evaluating quality\u2026',
  ],
};

const ROTATION_INTERVAL = 2500;
const VISIBLE_LOG_ENTRIES = 5;
const OPACITY_STEPS = [0.2, 0.35, 0.55, 0.75, 1];

export function WizardLoadingOverlay({
  operation,
  currentStage,
  progressLog,
}: WizardLoadingOverlayProps) {
  const fallbackMessages = FALLBACK_MESSAGES[operation];
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [fading, setFading] = useState(false);
  const mountTime = useRef(Date.now());

  const hasLog = progressLog.length > 0;

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - mountTime.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Fallback message rotation — only when no log events have arrived yet
  useEffect(() => {
    if (hasLog || fallbackMessages.length <= 1) return;
    const id = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % fallbackMessages.length);
        setFading(false);
      }, 200);
    }, ROTATION_INTERVAL);
    return () => clearInterval(id);
  }, [fallbackMessages, hasLog]);

  return (
    <div className="relative flex flex-col items-center justify-center h-full gap-6">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/8 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Loading animation */}
      <div className="relative">
        <AiLoadingAnimation />
      </div>

      {/* Fallback message — only shown before any real events arrive */}
      {!hasLog && (
        <p
          className={`text-sm font-medium text-foreground-secondary transition-opacity duration-200 ${
            fading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {fallbackMessages[messageIndex]}
        </p>
      )}

      {/* Elapsed time */}
      <span className="relative text-xs text-foreground-muted tabular-nums">{elapsed}s</span>

      {/* Unified activity log — last N entries with cascading opacity */}
      {hasLog &&
        (() => {
          const visible = progressLog.slice(-VISIBLE_LOG_ENTRIES);
          return (
            <div className="relative w-full max-w-2xl rounded-lg bg-background-secondary/50 px-4 py-3">
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {visible.map((entry, i) => {
                    const opacityIndex = i - (visible.length - OPACITY_STEPS.length);
                    const targetOpacity =
                      OPACITY_STEPS[Math.max(0, Math.min(opacityIndex, OPACITY_STEPS.length - 1))];

                    return (
                      <motion.div
                        key={`${entry.id}-${entry.timestamp}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: targetOpacity, y: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        {/* Icon */}
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={entry.isStage ? 'stage' : entry.completed ? 'done' : 'pending'}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                            className="shrink-0 w-5 text-center text-base"
                          >
                            {entry.isStage ? entry.icon : entry.completed ? '\u2705' : entry.icon}
                          </motion.span>
                        </AnimatePresence>

                        {/* Message + detail */}
                        <span className="min-w-0 flex items-baseline gap-1.5">
                          <span className="font-medium text-foreground-secondary whitespace-nowrap">
                            {entry.message}
                          </span>
                          {entry.detail && (
                            <span className="text-foreground-muted truncate">{entry.detail}</span>
                          )}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
