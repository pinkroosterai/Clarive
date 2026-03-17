import { Braces } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { buildTagString } from '@/lib/templateParser';
import type { TemplateField } from '@/types';

export interface VariableChipPopoverProps {
  /** The parsed template field to edit (null for new variable insertion) */
  field: TemplateField | null;
  /** Called with the full {{tag}} string when user clicks Apply */
  onApply: (tagString: string) => void;
  /** Called when user clicks Remove */
  onRemove: () => void;
  /** Controls popover visibility */
  open: boolean;
  /** Called when popover open state changes */
  onOpenChange: (open: boolean) => void;
  /** The trigger element (typically a chip or button) */
  children: React.ReactNode;
}

type FieldType = TemplateField['type'];

export function VariableChipPopover({
  field,
  onApply,
  onRemove,
  open,
  onOpenChange,
  children,
}: VariableChipPopoverProps) {
  const [name, setName] = useState(field?.name ?? 'variable');
  const [type, setType] = useState<FieldType>(field?.type ?? 'string');
  const [minVal, setMinVal] = useState(field?.min?.toString() ?? '');
  const [maxVal, setMaxVal] = useState(field?.max?.toString() ?? '');
  const [enumValues, setEnumValues] = useState(field?.enumValues.join(', ') ?? '');
  const [defaultValue, setDefaultValue] = useState(field?.defaultValue ?? '');
  const [description, setDescription] = useState(field?.description ?? '');

  // Sync local state when the field prop changes (popover stays mounted)
  useEffect(() => {
    setName(field?.name ?? 'variable');
    setType(field?.type ?? 'string');
    setMinVal(field?.min?.toString() ?? '');
    setMaxVal(field?.max?.toString() ?? '');
    setEnumValues(field?.enumValues.join(', ') ?? '');
    setDefaultValue(field?.defaultValue ?? '');
    setDescription(field?.description ?? '');
  }, [field]);

  const handleApply = () => {
    let constraintStr = '';
    if ((type === 'int' || type === 'float') && minVal && maxVal) {
      constraintStr = `${minVal}-${maxVal}`;
    } else if (type === 'enum' && enumValues.trim()) {
      constraintStr = enumValues
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .join(',');
    }

    const tagString = buildTagString({
      name: name.replace(/\W/g, '_') || 'variable',
      type,
      constraintStr,
      defaultValue: defaultValue.trim(),
      description: description.trim(),
    });

    onApply(tagString);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80 space-y-3"
        side="bottom"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Braces className="size-4 text-primary" />
          {field ? 'Edit Variable' : 'Insert Variable'}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="variable_name"
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">string</SelectItem>
                <SelectItem value="int">int</SelectItem>
                <SelectItem value="float">float</SelectItem>
                <SelectItem value="enum">enum</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(type === 'int' || type === 'float') && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Min</Label>
                <Input
                  type="number"
                  step={type === 'int' ? 1 : 0.01}
                  value={minVal}
                  onChange={(e) => setMinVal(e.target.value)}
                  placeholder="0"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max</Label>
                <Input
                  type="number"
                  step={type === 'int' ? 1 : 0.01}
                  value={maxVal}
                  onChange={(e) => setMaxVal(e.target.value)}
                  placeholder="100"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {type === 'enum' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Values (comma-separated)</Label>
              <Input
                value={enumValues}
                onChange={(e) => setEnumValues(e.target.value)}
                placeholder="option1, option2, option3"
                className="h-8 text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Default value</Label>
            <Input
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
              placeholder="Optional"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Hint shown to template users"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-between pt-1">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
            Remove
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
