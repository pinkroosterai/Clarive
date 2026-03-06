import { describe, it, expect } from "vitest";
import { renderTemplate } from "./templateRenderer";

describe("renderTemplate", () => {
  it("returns original content with no tags", () => {
    expect(renderTemplate("Hello world", {})).toBe("Hello world");
  });

  it("replaces a simple tag", () => {
    expect(renderTemplate("Hello {{name}}", { name: "Alice" })).toBe("Hello Alice");
  });

  it("replaces multiple tags", () => {
    const result = renderTemplate("{{greeting}} {{name}}!", {
      greeting: "Hi",
      name: "Bob",
    });
    expect(result).toBe("Hi Bob!");
  });

  it("leaves unmatched tags untouched", () => {
    expect(renderTemplate("{{known}} {{unknown}}", { known: "yes" })).toBe(
      "yes {{unknown}}",
    );
  });

  it("leaves tag untouched if value is empty string", () => {
    expect(renderTemplate("{{name}}", { name: "" })).toBe("{{name}}");
  });

  it("replaces typed tags", () => {
    expect(renderTemplate("Count: {{n|int:1-10}}", { n: "5" })).toBe("Count: 5");
  });

  it("replaces enum tags", () => {
    expect(
      renderTemplate("Style: {{tone|enum:formal,casual}}", { tone: "casual" }),
    ).toBe("Style: casual");
  });

  it("handles content with no values provided", () => {
    const content = "{{a}} and {{b}}";
    expect(renderTemplate(content, {})).toBe(content);
  });

  it("handles empty content", () => {
    expect(renderTemplate("", { name: "test" })).toBe("");
  });

  it("replaces duplicate tags", () => {
    expect(renderTemplate("{{x}} and {{x}}", { x: "val" })).toBe("val and val");
  });
});
