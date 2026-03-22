import { ChevronDown, Loader2, Sparkles } from 'lucide-react';

import type { PlaygroundTemplateState } from './utils';

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

interface TemplateVariablesSectionProps {
  template: PlaygroundTemplateState;
}

export function TemplateVariablesSection({ template }: TemplateVariablesSectionProps) {
  const { templateFields, fieldValues, setFieldValues, onFillTemplateFields, isFillingTemplateFields } = template;

  if (templateFields.length === 0) return null;

  const missingCount = templateFields.filter((f) => !fieldValues[f.name]).length;

  return (
    <Collapsible defaultOpen open={missingCount > 0 ? true : undefined} className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <CollapsibleTrigger className="group flex items-center gap-2 text-xs font-medium text-foreground-muted">
          <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
          Template Variables ({templateFields.length})
          {missingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
              {missingCount} required
            </span>
          )}
        </CollapsibleTrigger>
        {onFillTemplateFields && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
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
            {isFillingTemplateFields ? 'Generating...' : 'Fill with examples'}
          </Button>
        )}
      </div>
      <CollapsibleContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templateFields.map((field) => {
            const isEmpty = !fieldValues[field.name];
            return (
              <div key={field.name} className="space-y-1">
                <Label className="text-xs font-mono">{`{{${field.name}}}`}</Label>
                {field.type === 'enum' && field.enumValues.length > 0 ? (
                  <Select
                    value={fieldValues[field.name] || ''}
                    onValueChange={(v) =>
                      setFieldValues((prev) => ({ ...prev, [field.name]: v }))
                    }
                  >
                    <SelectTrigger
                      className={`h-8 text-xs ${isEmpty ? 'border-destructive' : ''}`}
                    >
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
                ) : (field.type === 'int' || field.type === 'float') &&
                  field.min !== null &&
                  field.max !== null ? (
                  <div className="flex items-center gap-2">
                    <Slider
                      min={field.min}
                      max={field.max}
                      step={field.type === 'int' ? 1 : 0.01}
                      value={[Number(fieldValues[field.name]) || field.min]}
                      onValueChange={([v]) =>
                        setFieldValues((prev) => ({ ...prev, [field.name]: String(v) }))
                      }
                      className="flex-1"
                    />
                    <span className="text-xs text-foreground-muted tabular-nums w-10 text-right">
                      {fieldValues[field.name] || field.min}
                    </span>
                  </div>
                ) : (
                  <Input
                    value={fieldValues[field.name] || ''}
                    onChange={(e) =>
                      setFieldValues((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                    placeholder={field.type !== 'string' ? field.type : 'value'}
                    className={`h-8 text-xs ${isEmpty ? 'border-destructive' : ''}`}
                    type={field.type === 'int' || field.type === 'float' ? 'number' : 'text'}
                  />
                )}
                {isEmpty && <p className="text-xs text-destructive">Required</p>}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
