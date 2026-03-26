import { ChevronDown, Loader2, Sparkles } from 'lucide-react';

import type { PlaygroundTemplateState } from './utils';

import { AutoExpandInput } from '@/components/ui/auto-expand-input';
import { Button } from '@/components/ui/button';
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
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TemplateVariablesSectionProps {
  template: PlaygroundTemplateState;
}

export function TemplateVariablesSection({ template }: TemplateVariablesSectionProps) {
  const {
    templateFields,
    fieldValues,
    setFieldValues,
    onFillTemplateFields,
    isFillingTemplateFields,
  } = template;

  if (templateFields.length === 0) return null;

  const missingCount = templateFields.filter((f) => !fieldValues[f.name]).length;

  return (
    <Collapsible defaultOpen open={missingCount > 0 ? true : undefined}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="group flex items-center gap-2 text-xs font-medium text-foreground-muted">
          <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
          Variables ({templateFields.length})
          {missingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
              {missingCount} empty
            </span>
          )}
        </CollapsibleTrigger>
        {onFillTemplateFields && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onFillTemplateFields}
                disabled={isFillingTemplateFields}
                aria-busy={isFillingTemplateFields}
                aria-label="Fill template fields with AI-generated examples"
              >
                {isFillingTemplateFields ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fill with examples</TooltipContent>
          </Tooltip>
        )}
      </div>
      <CollapsibleContent>
        <div className="grid grid-cols-1 gap-3 mt-2">
          {templateFields.map((field) => {
            const value = fieldValues[field.name] || '';
            const isEmpty = !fieldValues[field.name];
            const onChange = (v: string) =>
              setFieldValues((prev) => ({ ...prev, [field.name]: v }));

            const isEnum = field.type === 'enum' && field.enumValues.length > 0;
            const isSlider =
              (field.type === 'int' || field.type === 'float') &&
              field.min !== null &&
              field.max !== null;

            return (
              <div key={field.name} className="space-y-1.5">
                <Label className="text-xs">
                  {field.name}
                  <span className="ml-1 text-foreground-muted">({field.type})</span>
                </Label>

                {isEnum ? (
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger className={cn('h-9 text-sm', isEmpty && 'border-destructive')}>
                      <SelectValue placeholder={`Select ${field.name}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.enumValues.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : isSlider ? (
                  <div className="flex items-center gap-3">
                    <Slider
                      min={field.min!}
                      max={field.max!}
                      step={field.type === 'int' ? 1 : 0.01}
                      value={[Number(value) || field.min!]}
                      onValueChange={([v]) => onChange(String(v))}
                      className="flex-1"
                    />
                    <span className="text-sm text-foreground-muted tabular-nums w-12 text-right">
                      {value || field.min}
                    </span>
                  </div>
                ) : field.type === 'string' ? (
                  <AutoExpandInput
                    value={value}
                    onChange={onChange}
                    placeholder={field.description ?? 'value'}
                    className={cn('h-9 text-sm', isEmpty && 'border-destructive')}
                  />
                ) : (
                  <Input
                    type="number"
                    step={field.type === 'int' ? 1 : 0.01}
                    min={field.min ?? undefined}
                    max={field.max ?? undefined}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={field.type}
                    className={cn('h-9 text-sm', isEmpty && 'border-destructive')}
                  />
                )}

                {field.description && (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
