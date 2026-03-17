import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AiLoadingAnimation } from '@/components/wizard/AiLoadingAnimation';

interface EditorAiOverlayProps {
  isVisible: boolean;
  label: string;
  onCancel?: () => void;
}

export function EditorAiOverlay({ isVisible, label, onCancel }: EditorAiOverlayProps) {
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
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/60 backdrop-blur-sm"
          style={{ pointerEvents: 'all' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <AiLoadingAnimation />
          <p className="text-sm font-medium text-foreground-muted">{label}</p>
          <span className="text-xs text-foreground-muted tabular-nums">{elapsed}s</span>
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} className="mt-2">
              Cancel
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
