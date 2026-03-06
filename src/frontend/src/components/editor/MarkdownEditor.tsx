import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { useEffect, useMemo, useRef } from 'react';

import { EditorBubbleMenu } from '@/components/editor/EditorBubbleMenu';
import { debounce } from '@/lib/debounce';
import { buildExtensions } from '@/lib/tiptap/extensions';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  /** Markdown string (the source of truth, owned by parent) */
  content: string;
  /** Called with the updated markdown string when content changes */
  onContentChange: (markdown: string) => void;
  /** Whether the editor is editable (false = read-only rendered markdown) */
  editable: boolean;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether to enable template tag highlighting ({{var}}) */
  templateHighlight?: boolean;
  /** Minimum height CSS class (default: "min-h-[120px]") */
  minHeightClass?: string;
  /** Additional className for the editor container */
  className?: string;
  /** Auto-focus the editor on mount */
  autoFocus?: boolean;
}

export function MarkdownEditor({
  content,
  onContentChange,
  editable,
  placeholder,
  templateHighlight = false,
  minHeightClass = 'min-h-[120px]',
  className,
  autoFocus = false,
}: MarkdownEditorProps) {
  const lastExternalContent = useRef(content);
  const isLocalUpdate = useRef(false);
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  // Freeze initial content for useEditor — we handle content sync ourselves
  // to prevent Tiptap v3's internal compareOptions/setOptions from racing
  // with focus events and calling view.updateState during DOM reconciliation.
  const initialContent = useRef(content);

  const extensions = useMemo(
    () => buildExtensions({ placeholder, templateHighlight }),
    [placeholder, templateHighlight]
  );

  const debouncedUpdate = useMemo(
    () =>
      debounce((...args: unknown[]) => {
        const ed = args[0] as Editor;
        isLocalUpdate.current = true;
        onContentChangeRef.current(ed.getMarkdown());
      }, 150),
    []
  );

  const editor = useEditor({
    extensions,
    content: initialContent.current,
    contentType: 'markdown',
    editable,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor: ed }) => {
      debouncedUpdate(ed);
    },
  });

  // Sync external content changes into the editor (skip self-generated updates)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      lastExternalContent.current = content;
      return;
    }

    if (content !== lastExternalContent.current) {
      lastExternalContent.current = content;
      const editorMarkdown = editor.getMarkdown();

      if (content !== editorMarkdown) {
        editor.commands.setContent(content, { emitUpdate: false, contentType: 'markdown' });
      }
    }
  }, [content, editor]);

  // Sync editable prop — guard against no-op to avoid spurious update events
  // (Tiptap's setEditable unconditionally emits "update", triggering debouncedUpdate)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  // Cancel pending debounce on unmount — do NOT flush content here.
  // Flushing would race with prompt deletion: the unmounting editor's
  // onContentChange fires with stale closure data, undoing the delete.
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-elevated focus-within:ring-2 focus-within:ring-primary/30 transition-shadow',
        minHeightClass,
        className
      )}
    >
      <EditorContent editor={editor} className="px-3 py-2" />
      {editable && editor && <EditorBubbleMenu editor={editor} />}
    </div>
  );
}
