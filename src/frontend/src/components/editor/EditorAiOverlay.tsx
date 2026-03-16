import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { AiLoadingAnimation } from '@/components/wizard/AiLoadingAnimation';

interface EditorAiOverlayProps {
  isVisible: boolean;
  label: string;
}

export function EditorAiOverlay({ isVisible, label }: EditorAiOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const mountTime = useRef(Date.now());

  // Reset timer when overlay appears
  useEffect(() => {
    if (isVisible) {
      mountTime.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - mountTime.current) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background/60 backdrop-blur-sm"
        >
          <AiLoadingAnimation />
          <p className="text-sm font-medium text-foreground-secondary">{label}</p>
          <span className="text-xs text-foreground-muted tabular-nums">{elapsed}s</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
