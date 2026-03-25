import { ExternalLink, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';

import { ActionGroup } from '@/components/shared/ActionGroup';
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
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="size-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold text-foreground truncate">{content.title}</h3>
        </div>
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
        <ActionGroup label="System Message">
          <div className="rounded-md bg-muted/30 p-3 text-xs leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {renderTemplate(content.systemMessage, fieldValues)}
            </ReactMarkdown>
          </div>
        </ActionGroup>
      )}

      {/* Prompt chain */}
      {content.prompts
        .sort((a, b) => a.order - b.order)
        .map((prompt, index) => (
          <ActionGroup key={prompt.id} label={`Prompt #${index + 1}`}>
            <div className="rounded-md border border-border-subtle p-3 text-xs leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {renderTemplate(prompt.content, fieldValues)}
              </ReactMarkdown>
            </div>
          </ActionGroup>
        ))}
    </div>
  );
}
