import { ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ReasoningBlockProps {
  reasoning: string;
  defaultOpen: boolean;
  isStreaming?: boolean;
}

export default function ReasoningBlock({
  reasoning,
  defaultOpen,
  isStreaming,
}: ReasoningBlockProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 mb-1">
        <ChevronDown className="size-3" />
        Thinking
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className={`rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/20 p-3 mb-3 ${isStreaming ? 'max-h-96' : 'max-h-64'} overflow-y-auto`}
        >
          <div className="prose prose-xs dark:prose-invert max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-pre:bg-indigo-100 dark:prose-pre:bg-indigo-900/30 prose-pre:text-xs prose-code:text-xs text-indigo-800 dark:text-indigo-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
