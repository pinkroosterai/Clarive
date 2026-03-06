import type { Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { TemplateHighlight } from "./templateMark";

interface ExtensionOptions {
  placeholder?: string;
  templateHighlight?: boolean;
}

export function buildExtensions(options: ExtensionOptions): Extensions {
  const extensions: Extensions = [
    StarterKit.configure({
      blockquote: false,
      horizontalRule: false,
    }),
    Markdown,
  ];

  if (options.placeholder) {
    extensions.push(
      Placeholder.configure({ placeholder: options.placeholder }),
    );
  }

  if (options.templateHighlight) {
    extensions.push(TemplateHighlight);
  }

  return extensions;
}
