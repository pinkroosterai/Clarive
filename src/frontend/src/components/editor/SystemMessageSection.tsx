import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MessageSquare, Plus, X } from 'lucide-react';
import { useState, useEffect } from 'react';

import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SystemMessageSectionProps {
  systemMessage: string | null;
  onChange: (value: string | null) => void;
  isReadOnly: boolean;
}

export function SystemMessageSection({
  systemMessage,
  onChange,
  isReadOnly,
}: SystemMessageSectionProps) {
  const [shouldAutoFocus, setShouldAutoFocus] = useState(false);

  // Reset auto-focus flag after the editor mounts with it
  useEffect(() => {
    if (shouldAutoFocus) setShouldAutoFocus(false);
  }, [shouldAutoFocus]);

  return (
    <AnimatePresence mode="wait">
      {systemMessage === null ? (
        !isReadOnly && (
          <motion.div
            key="add-btn"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            data-tour="system-message"
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setShouldAutoFocus(true);
                onChange('');
              }}
            >
              <Plus className="size-4" />
              Add system message
            </Button>
          </motion.div>
        )
      ) : (
        <motion.div
          key="sys-msg"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <Collapsible defaultOpen data-tour="system-message">
            <div className="flex items-center gap-2 border-l-2 border-primary pl-3">
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
                <ChevronDown className="chevron size-4 text-foreground-muted transition-transform duration-200" />
                <MessageSquare className="size-4 text-foreground-muted" />
                System Message
              </CollapsibleTrigger>
              {!isReadOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => onChange(null)}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            <CollapsibleContent className="mt-2">
              <MarkdownEditor
                content={systemMessage}
                onContentChange={(md) => onChange(md)}
                editable={!isReadOnly}
                placeholder="Enter a system message to set the AI's behavior..."
                minHeightClass="min-h-[80px]"
                autoFocus={shouldAutoFocus} // eslint-disable-line jsx-a11y/no-autofocus
              />
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
