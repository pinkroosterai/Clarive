import { TAG_PATTERN } from "@/lib/templateParser";

export function renderTemplate(
  content: string,
  values: Record<string, string>,
): string {
  return content.replace(new RegExp(TAG_PATTERN, "g"), (fullMatch, name: string) => {
    return name in values && values[name] !== "" ? values[name] : fullMatch;
  });
}
