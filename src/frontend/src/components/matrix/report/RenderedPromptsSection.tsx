import type { RenderedPromptEntry } from '@/types/report';

interface RenderedPromptsSectionProps {
  prompts: RenderedPromptEntry[];
}

export function RenderedPromptsSection({ prompts }: RenderedPromptsSectionProps) {
  if (prompts.length === 0) return null;

  return (
    <div className="space-y-6">
      {prompts.map((entry, i) => (
        <div key={i} className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">{entry.versionLabel}</h4>

          {entry.systemMessage && (
            <div className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                System Message
              </span>
              <pre className="whitespace-pre-wrap text-sm rounded-lg border border-border-subtle bg-muted/30 p-4 font-mono leading-relaxed">
                {entry.systemMessage}
              </pre>
            </div>
          )}

          {entry.renderedPrompts.map((prompt, j) => (
            <div key={j} className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {entry.renderedPrompts.length > 1 ? `Prompt ${j + 1}` : 'User Prompt'}
              </span>
              <pre className="whitespace-pre-wrap text-sm rounded-lg border border-border-subtle bg-muted/30 p-4 font-mono leading-relaxed">
                {prompt}
              </pre>
            </div>
          ))}

          {!entry.systemMessage && entry.renderedPrompts.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No prompt content available</p>
          )}
        </div>
      ))}
    </div>
  );
}
