import { Plus, Trash2 } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PARAM_TYPES = ['string', 'integer', 'number', 'boolean', 'array', 'object'] as const;
type ParamType = (typeof PARAM_TYPES)[number];

export interface ToolParam {
  name: string;
  type: ParamType;
  required: boolean;
  description: string;
}

interface ToolParameterEditorProps {
  params: ToolParam[];
  onChange: (params: ToolParam[]) => void;
}

/** Converts an inputSchema JSON Schema object to ToolParam array for editing. */
export function schemaToParams(schema?: Record<string, unknown>): ToolParam[] {
  if (!schema) return [];
  const properties = schema.properties as
    | Record<string, { type?: string; description?: string }>
    | undefined;
  if (!properties) return [];

  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);

  return Object.entries(properties).map(([name, def]) => ({
    name,
    type: (PARAM_TYPES.includes(def?.type as ParamType) ? def.type : 'string') as ParamType,
    required: required.has(name),
    description: def?.description ?? '',
  }));
}

/** Converts ToolParam array back to JSON Schema object. Returns undefined if no params. */
export function paramsToSchema(params: ToolParam[]): Record<string, unknown> | undefined {
  const valid = params.filter((p) => p.name.trim());
  if (valid.length === 0) return undefined;

  const properties: Record<string, Record<string, string>> = {};
  const required: string[] = [];

  for (const p of valid) {
    const prop: Record<string, string> = { type: p.type };
    if (p.description.trim()) prop.description = p.description.trim();
    properties[p.name.trim()] = prop;
    if (p.required) required.push(p.name.trim());
  }

  const schema: Record<string, unknown> = { type: 'object', properties };
  if (required.length > 0) schema.required = required;
  return schema;
}

export function ToolParameterEditor({ params, onChange }: ToolParameterEditorProps) {
  const addParam = useCallback(() => {
    onChange([...params, { name: '', type: 'string', required: false, description: '' }]);
  }, [params, onChange]);

  const removeParam = useCallback(
    (index: number) => {
      onChange(params.filter((_, i) => i !== index));
    },
    [params, onChange]
  );

  const updateParam = useCallback(
    (index: number, field: keyof ToolParam, value: string | boolean) => {
      const updated = params.map((p, i) => (i === index ? { ...p, [field]: value } : p));
      onChange(updated);
    },
    [params, onChange]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Parameters</Label>
        <Button type="button" variant="outline" size="sm" onClick={addParam}>
          <Plus className="size-3 mr-1" />
          Add
        </Button>
      </div>

      {params.length === 0 && (
        <p className="text-xs text-foreground-muted">
          No parameters defined. Add parameters to describe the tool&apos;s input schema.
        </p>
      )}

      {params.map((param, index) => (
        <div key={index} className="flex items-start gap-2 bg-elevated rounded-lg p-2.5">
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="name"
                value={param.name}
                onChange={(e) => updateParam(index, 'name', e.target.value)}
                className="font-mono text-sm h-8"
              />
              <select
                value={param.type}
                onChange={(e) => updateParam(index, 'type', e.target.value)}
                className="h-8 w-28 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {PARAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Description (optional)"
                value={param.description}
                onChange={(e) => updateParam(index, 'description', e.target.value)}
                className="text-sm h-8 flex-1"
              />
              <label
                htmlFor={`param-req-${index}`}
                className="flex items-center gap-1.5 text-xs text-foreground-muted shrink-0 cursor-pointer"
              >
                <Checkbox
                  id={`param-req-${index}`}
                  checked={param.required}
                  onCheckedChange={(v) => updateParam(index, 'required', !!v)}
                />
                Required
              </label>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
            onClick={() => removeParam(index)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
