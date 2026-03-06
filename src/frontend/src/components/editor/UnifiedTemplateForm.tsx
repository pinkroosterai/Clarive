import { ChevronDown, Copy, Eye, EyeOff, FileCode } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { parseTemplateTags, TAG_PATTERN } from '@/lib/templateParser';
import { renderTemplate } from '@/lib/templateRenderer';
import { copyToClipboard } from '@/lib/utils';
import type { Prompt, TemplateField } from '@/types';

interface UnifiedTemplateFormProps {
  prompts: Prompt[];
  isReadOnly: boolean;
}

/**
 * Collect template fields from all prompts, deduplicated by name.
 * First occurrence of each field name wins (determines type, range, enum values).
 */
function collectTemplateFields(prompts: Prompt[]): TemplateField[] {
  const seen = new Set<string>();
  const fields: TemplateField[] = [];

  for (const prompt of prompts) {
    for (const field of parseTemplateTags(prompt.content)) {
      if (!seen.has(field.name)) {
        seen.add(field.name);
        fields.push(field);
      }
    }
  }

  return fields;
}

function getValidationError(field: TemplateField, value: string): string | null {
  if (!value) return null;

  if (field.type === 'int') {
    if (!Number.isInteger(Number(value)) || value.includes('.')) {
      return 'Must be a whole number';
    }
    const n = Number(value);
    if (field.min !== null && n < field.min) return `Min value is ${field.min}`;
    if (field.max !== null && n > field.max) return `Max value is ${field.max}`;
  }

  if (field.type === 'float') {
    if (isNaN(Number(value))) return 'Must be a number';
    const n = Number(value);
    if (field.min !== null && n < field.min) return `Min value is ${field.min}`;
    if (field.max !== null && n > field.max) return `Max value is ${field.max}`;
  }

  return null;
}

/**
 * Render template content as React nodes: filled tags become plain text,
 * unfilled tags get an amber warning highlight showing the raw {{tag}} syntax.
 */
function renderTemplateElements(content: string, values: Record<string, string>): ReactNode[] {
  const tagRegex = new RegExp(TAG_PATTERN, 'g');
  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tagRegex.exec(content)) !== null) {
    // Text before this tag
    if (match.index > lastIndex) {
      elements.push(content.slice(lastIndex, match.index));
    }

    const name = match[1];
    const hasValue = name in values && values[name] !== '';

    if (hasValue) {
      elements.push(values[name]);
    } else {
      elements.push(
        <span key={key++} className="rounded bg-warning-bg px-1 text-warning-text">
          {match[0]}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Trailing text after the last tag
  if (lastIndex < content.length) {
    elements.push(content.slice(lastIndex));
  }

  return elements;
}

function RenderedPromptPreview({
  index,
  content,
  values,
}: {
  index: number;
  content: string;
  values: Record<string, string>;
}) {
  const elements = renderTemplateElements(content, values);

  const handleCopy = async () => {
    try {
      await copyToClipboard(renderTemplate(content, values));
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground-muted">Prompt #{index}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
              <Copy className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy to clipboard</TooltipContent>
        </Tooltip>
      </div>
      <div className="rounded-md bg-elevated p-3 text-sm whitespace-pre-wrap">{elements}</div>
    </div>
  );
}

export function UnifiedTemplateForm({ prompts, isReadOnly }: UnifiedTemplateFormProps) {
  const fields = useMemo(() => collectTemplateFields(prompts), [prompts]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Prune stale values when fields change (e.g., tag removed from prompt)
  useEffect(() => {
    const validNames = new Set(fields.map((f) => f.name));
    setValues((prev) => {
      const pruned = Object.fromEntries(Object.entries(prev).filter(([k]) => validNames.has(k)));
      return Object.keys(pruned).length === Object.keys(prev).length ? prev : pruned;
    });
  }, [fields]);

  if (fields.length === 0) return null;

  const updateValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const getValue = (field: TemplateField) => values[field.name] ?? field.defaultValue ?? '';

  return (
    <Collapsible defaultOpen>
      <div className="flex items-center gap-2 border-l-2 border-primary pl-3">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors [&[data-state=open]>svg.chevron]:rotate-180">
          <ChevronDown className="chevron size-4 text-foreground-muted transition-transform duration-200" />
          <FileCode className="size-4 text-foreground-muted" />
          Template Variables
          <span className="text-xs text-foreground-muted font-normal">({fields.length})</span>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-3">
        <Card className="border-dashed">
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-4">
              {fields.map((field) => {
                const value = getValue(field);
                const error = getValidationError(field, value);

                return (
                  <div key={field.name} className="space-y-1.5">
                    <Label className="text-xs">
                      {field.name}
                      <span className="ml-1 text-foreground-muted">({field.type})</span>
                    </Label>

                    {field.type === 'enum' ? (
                      <Select
                        value={value}
                        onValueChange={(v) => updateValue(field.name, v)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder={`Select ${field.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.enumValues.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={field.type === 'string' ? 'text' : 'number'}
                        step={field.type === 'int' ? 1 : 0.01}
                        min={field.min ?? undefined}
                        max={field.max ?? undefined}
                        value={value}
                        onChange={(e) => updateValue(field.name, e.target.value)}
                        disabled={isReadOnly}
                        className="h-9 text-sm"
                      />
                    )}

                    {error && <p className="text-[0.8rem] font-medium text-error-text">{error}</p>}
                  </div>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview((p) => !p)}
              className="gap-1.5"
            >
              {showPreview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showPreview ? 'Hide preview' : 'Preview'}
            </Button>

            {showPreview && (
              <div className="space-y-3">
                {prompts.map((prompt, i) => (
                  <RenderedPromptPreview
                    key={prompt.id}
                    index={i + 1}
                    content={prompt.content}
                    values={values}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
