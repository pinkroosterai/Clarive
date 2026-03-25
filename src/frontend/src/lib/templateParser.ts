import type { TemplateField } from '@/types';

/** Canonical source for the template-tag pattern. All other tag regexes derive from this. */
export const TAG_PATTERN = String.raw`\{\{(\w+)(?:\|(\w+)(?::([^}]+))?)?\}\}`;

/**
 * Parse template tags from content.
 *
 * Supported syntax (all backward-compatible):
 *   {{name}}                              → string, no constraints
 *   {{name|type}}                         → typed, no constraints
 *   {{name|type:constraints}}             → typed with constraints
 *   {{name|type:constraints:default}}     → typed with constraints and default value
 *   {{name|type:constraints:default:desc}} → typed with constraints, default, and description
 *
 * Constraints format by type:
 *   int/float → "min-max" (e.g., "1-100")
 *   enum      → "val1,val2,val3"
 *   string    → (none, leave empty)
 *
 * Examples:
 *   {{topic}}                                    → string "topic"
 *   {{count|int:1-100:50}}                       → int 1-100, default "50"
 *   {{tone|enum:formal,casual:formal:Tone style}} → enum, default "formal", desc "Tone style"
 *   {{hint|string:::A helpful hint}}              → string, no default, desc "A helpful hint"
 */
export function parseTemplateTags(content: string): TemplateField[] {
  const seen = new Set<string>();
  const fields: TemplateField[] = [];
  const tagRegex = new RegExp(TAG_PATTERN, 'g');

  for (const match of content.matchAll(tagRegex)) {
    try {
      const name = match[1];
      const rawType = match[2] ?? 'string';
      const rawOptions = match[3] ?? '';

      if (seen.has(name)) continue;
      seen.add(name);

      const type = (
        ['string', 'int', 'float', 'enum'].includes(rawType) ? rawType : 'string'
      ) as TemplateField['type'];

      // Split options by colon: constraints:default:description
      // Description may contain colons, so rejoin parts[2+]
      const parts = rawOptions ? rawOptions.split(':') : [];
      const constraintStr = parts[0] ?? '';
      const defaultStr = parts.length > 1 ? parts[1] : '';
      const descriptionStr = parts.length > 2 ? parts.slice(2).join(':') : '';

      const field: TemplateField = {
        name,
        type,
        enumValues: [],
        defaultValue: defaultStr || null,
        description: descriptionStr || null,
        min: null,
        max: null,
      };

      if ((type === 'int' || type === 'float') && constraintStr) {
        const rangeMatch = constraintStr.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
        if (rangeMatch) {
          const min = Number(rangeMatch[1]);
          const max = Number(rangeMatch[2]);
          if (!isNaN(min) && !isNaN(max)) {
            field.min = min;
            field.max = max;
          }
        }
      }

      if (type === 'enum' && constraintStr) {
        field.enumValues = constraintStr
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      }

      fields.push(field);
    } catch {
      // skip malformed tags
    }
  }

  return fields;
}

/**
 * Build a template tag string from field values.
 * Produces the minimal syntax needed — omits trailing empty segments.
 */
export function buildTagString(field: {
  name: string;
  type: TemplateField['type'];
  constraintStr?: string;
  defaultValue?: string;
  description?: string;
}): string {
  const { name, type, constraintStr = '', defaultValue = '', description = '' } = field;

  // Build from right to left, only including non-empty trailing parts
  if (description) {
    return `{{${name}|${type}:${constraintStr}:${defaultValue}:${description}}}`;
  }
  if (defaultValue) {
    return `{{${name}|${type}:${constraintStr}:${defaultValue}}}`;
  }
  if (constraintStr) {
    return `{{${name}|${type}:${constraintStr}}}`;
  }
  if (type !== 'string') {
    return `{{${name}|${type}}}`;
  }
  return `{{${name}}}`;
}