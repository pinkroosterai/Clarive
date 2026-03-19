import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Copy, HelpCircle, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';
import { toast } from 'sonner';

import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyToClipboard } from '@/lib/utils';
import type { Prompt } from '@/types';

const SYNTAX_ROWS = [
  { type: 'string', example: '{{topic}}', description: 'Text input (default)' },
  { type: 'int', example: '{{count|int:1-100}}', description: 'Integer with range' },
  { type: 'float', example: '{{temp|float:0-2}}', description: 'Decimal with range' },
  { type: 'enum', example: '{{tone|enum:formal,casual}}', description: 'Dropdown select' },
  { type: 'default', example: '{{x|int:1-10:5}}', description: 'With default value' },
  { type: 'desc', example: '{{x|string:::Hint text}}', description: 'With description' },
] as const;

function TemplateSyntaxHelp() {
  return (
    <div className="rounded-lg bg-surface border border-border p-3 text-xs">
      <p className="mb-2 font-medium text-foreground">Template tag syntax</p>
      <code className="mb-2 block text-foreground-muted">
        {'{{name}}  {{name|type:opts:default:description}}'}
      </code>
      <table className="w-full text-left">
        <thead>
          <tr className="text-foreground-muted">
            <th className="pb-1 pr-3 font-medium">Type</th>
            <th className="pb-1 pr-3 font-medium">Example</th>
            <th className="pb-1 font-medium">Result</th>
          </tr>
        </thead>
        <tbody className="text-foreground">
          {SYNTAX_ROWS.map((row) => (
            <tr key={row.type}>
              <td className="pr-3 py-0.5">
                <code className="rounded bg-elevated px-1">{row.type}</code>
              </td>
              <td className="pr-3 py-0.5">
                <code className="text-primary">{row.example}</code>
              </td>
              <td className="py-0.5 text-foreground-muted">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-primary/80">
        Tip: Click any highlighted {'{{variable}}'} in the editor to configure it visually.
      </p>
    </div>
  );
}

interface PromptCardProps {
  prompt: Prompt;
  index: number;
  isOnly: boolean;
  isLast: boolean;
  isReadOnly: boolean;
  onUpdate: (updated: Prompt) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export const PromptCard = memo(function PromptCard({
  prompt,
  index,
  isOnly,
  isLast,
  isReadOnly,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: PromptCardProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(prompt.content);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const BORDER_COLORS = ['border-l-blue-500', 'border-l-cyan-500', 'border-l-emerald-500', 'border-l-violet-500', 'border-l-amber-500'];
  const borderColor = BORDER_COLORS[(index - 1) % BORDER_COLORS.length];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      whileHover={{ boxShadow: '0 4px 20px -4px hsl(var(--primary) / 0.10)' }}
      className="rounded-xl"
    >
      <Card className={`border-l-2 ${borderColor} transition-shadow`}>
        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <span className="text-sm font-medium text-foreground">Prompt #{index}</span>
            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-foreground-muted"
                    aria-label="Toggle template syntax help"
                  >
                    <HelpCircle className="size-3.5" />
                    Syntax help
                  </Button>
                </CollapsibleTrigger>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8" onClick={handleCopy}>
                    <Copy className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy to clipboard</TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0 pb-3">
              <TemplateSyntaxHelp />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>

        <CardContent className="space-y-2">
          <MarkdownEditor
            key={prompt.id}
            content={prompt.content}
            onContentChange={(md) => onUpdate({ ...prompt, content: md })}
            editable={!isReadOnly}
            placeholder="Enter your prompt…"
            templateHighlight={true}
            minHeightClass="min-h-[120px]"
          />
          {prompt.content.length > 0 && (
            <div className="text-right text-xs text-foreground-muted">
              {prompt.content.length.toLocaleString()} chars
            </div>
          )}
        </CardContent>

        {!isOnly && !isReadOnly && (
          <CardFooter className="justify-between pt-0">
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div whileTap={{ scale: 0.92 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === 1}
                      onClick={onMoveUp}
                      aria-label="Move up"
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Move up</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.div whileTap={{ scale: 0.92 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={isLast}
                      onClick={onMoveDown}
                      aria-label="Move down"
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent side="bottom">Move down</TooltipContent>
              </Tooltip>
            </div>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive gap-1.5"
                onClick={onDelete}
              >
                <Trash2 className="size-3.5" /> Remove
              </Button>
            </motion.div>
          </CardFooter>
        )}
      </Card>
    </motion.div>
  );
});
