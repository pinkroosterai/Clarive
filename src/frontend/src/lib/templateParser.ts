import type { TemplateField } from "@/types";

/** Canonical source for the template-tag pattern. All other tag regexes derive from this. */
export const TAG_PATTERN = String.raw`\{\{(\w+)(?:\|(\w+)(?::([^}]+))?)?\}\}`;

export function parseTemplateTags(content: string): TemplateField[] {
  const seen = new Set<string>();
  const fields: TemplateField[] = [];
  const tagRegex = new RegExp(TAG_PATTERN, "g");

  for (const match of content.matchAll(tagRegex)) {
    try {
      const name = match[1];
      const rawType = match[2] ?? "string";
      const options = match[3] ?? "";

      if (seen.has(name)) continue;
      seen.add(name);

      const type = (["string", "int", "float", "enum"].includes(rawType)
        ? rawType
        : "string") as TemplateField["type"];

      const field: TemplateField = {
        name,
        type,
        enumValues: [],
        defaultValue: null,
        min: null,
        max: null,
      };

      if ((type === "int" || type === "float") && options) {
        const rangeMatch = options.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
        if (rangeMatch) {
          const min = Number(rangeMatch[1]);
          const max = Number(rangeMatch[2]);
          if (!isNaN(min) && !isNaN(max)) {
            field.min = min;
            field.max = max;
          }
        }
      }

      if (type === "enum" && options) {
        field.enumValues = options.split(",").map((v) => v.trim()).filter(Boolean);
      }

      fields.push(field);
    } catch {
      // skip malformed tags
    }
  }

  return fields;
}
