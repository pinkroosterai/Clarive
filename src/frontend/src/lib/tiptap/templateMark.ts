import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { TAG_PATTERN } from '@/lib/templateParser';

const templateHighlightKey = new PluginKey('templateHighlight');

function buildDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    // Fresh regex per text node — avoids shared lastIndex state across editor instances
    const tagRegex = new RegExp(TAG_PATTERN, 'g');
    let match: RegExpExecArray | null;

    while ((match = tagRegex.exec(node.text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;

      decorations.push(
        Decoration.inline(from, to, {
          class: 'template-tag',
          'data-tag-from': String(from),
          'data-tag-to': String(to),
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const TemplateHighlight = Extension.create({
  name: 'templateHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: templateHighlightKey,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc);
          },
          apply(tr, oldDecorations) {
            if (tr.docChanged) {
              return buildDecorations(tr.doc);
            }
            return oldDecorations;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
