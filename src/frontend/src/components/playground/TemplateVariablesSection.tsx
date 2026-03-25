import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import type { PlaygroundTemplateState } from './utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import type { TemplateField } from '@/types';

interface TemplateVariablesSectionProps {
  template: PlaygroundTemplateState;
}

export function TemplateVariablesSection({ template }: TemplateVariablesSectionProps) {
  const { templateFields, fieldValues, setFieldValues, onFillTemplateFields, isFillingTemplateFields } = template;

  if (templateFields.length === 0) return null;

  const missingCount = templateFields.filter((f) => !fieldValues[f.name]).length;

  return (
    <Collapsible defaultOpen open={missingCount > 0 ? true : undefined}>
      <div className="flex items-center justify-between">
        <CollapsibleTrigger className="group flex items-center gap-2 text-xs font-medium text-foreground-muted">
          <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
          Variables ({templateFields.length})
          {missingCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {missingCount} empty
            </Badge>
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
        <div className="flex flex-wrap gap-2 mt-2">
          {templateFields.map((field) => (
            <FieldPill
              key={field.name}
              field={field}
              value={fieldValues[field.name] || ''}
              isEmpty={!fieldValues[field.name]}
              onChange={(v) =>
                setFieldValues((prev) => ({ ...prev, [field.name]: v }))
              }
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface FieldPillProps {
  field: TemplateField;
  value: string;
  isEmpty: boolean;
  onChange: (value: string) => void;
}

function FieldPill({ field, value, isEmpty, onChange }: FieldPillProps) {
  const isEnum = field.type === 'enum' && field.enumValues.length > 0;
  const isSlider =
    (field.type === 'int' || field.type === 'float') &&
    field.min !== null &&
    field.max !== null;

  if (isEnum) return <EnumPill field={field} value={value} isEmpty={isEmpty} onChange={onChange} />;
  if (isSlider) return <SliderPill field={field} value={value} isEmpty={isEmpty} onChange={onChange} />;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 border rounded-md px-2 py-1 text-xs',
        isEmpty && 'border-destructive',
      )}
    >
      <span className="font-mono text-foreground-muted whitespace-nowrap">{field.name}:</span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.type !== 'string' ? field.type : 'value'}
        className="h-5 w-24 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
        type={field.type === 'int' || field.type === 'float' ? 'number' : 'text'}
      />
    </div>
  );
}

function EnumPill({ field, value, isEmpty, onChange }: FieldPillProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 border rounded-md px-2 py-1 text-xs cursor-pointer hover:bg-muted/50 transition-colors',
            isEmpty && 'border-destructive',
          )}
        >
          <span className="font-mono text-foreground-muted whitespace-nowrap">{field.name}:</span>
          <span className={cn(!value && 'text-foreground-muted')}>
            {value || 'Select...'}
          </span>
          <ChevronDown className="size-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <Select
          value={value}
          onValueChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.enumValues.map((v) => (
              <SelectItem key={v} value={v} className="text-xs">
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PopoverContent>
    </Popover>
  );
}

function SliderPill({ field, value, isEmpty, onChange }: FieldPillProps) {
  const [open, setOpen] = useState(false);
  const numValue = Number(value) || field.min!;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 border rounded-md px-2 py-1 text-xs cursor-pointer hover:bg-muted/50 transition-colors',
            isEmpty && 'border-destructive',
          )}
        >
          <span className="font-mono text-foreground-muted whitespace-nowrap">{field.name}:</span>
          <span className="tabular-nums">{value || field.min}</span>
          <ChevronDown className="size-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="flex items-center gap-3">
          <Slider
            min={field.min!}
            max={field.max!}
            step={field.type === 'int' ? 1 : 0.01}
            value={[numValue]}
            onValueChange={([v]) => onChange(String(v))}
            className="flex-1"
          />
          <span className="text-xs text-foreground-muted tabular-nums w-10 text-right">
            {numValue}
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
