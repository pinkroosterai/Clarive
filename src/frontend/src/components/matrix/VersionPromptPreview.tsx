import { ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';

import { renderTemplate } from '@/lib/templateRenderer';
import type { PromptEntry } from '@/types';

interface VersionPromptPreviewProps {
  entryId: string;
  content: PromptEntry;
  fieldValues: Record<string, string>;
}

export function VersionPromptPreview({
  entryId,
  content,
  fieldValues,
}: VersionPromptPreviewProps) {
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium truncate">{content.title}</h3>
        <Link
          to={`/entry/${entryId}`}
          className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors shrink-0"
        >
          <ExternalLink className="size-3" />
          Editor
        </Link>
      </div>

      {/* System message */}
      {content.systemMessage && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">
            System Message
          </div>
          <div className="rounded-md bg-muted/30 p-3 text-xs leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {renderTemplate(content.systemMessage, fieldValues)}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Prompt chain */}
      {content.prompts
        .sort((a, b) => a.order - b.order)
        .map((prompt, index) => (
          <div key={prompt.id} className="space-y-1">
            <div className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide">
              Prompt #{index + 1}
            </div>
            <div className="rounded-md border border-border-subtle p-3 text-xs leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {renderTemplate(prompt.content, fieldValues)}
              </ReactMarkdown>
            </div>
          </div>
        ))}
    </div>
  );
}
