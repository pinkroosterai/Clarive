import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Braces } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EditorBubbleMenu } from '@/components/editor/EditorBubbleMenu';
import { VariableChipPopover } from '@/components/editor/VariableChipPopover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { debounce } from '@/lib/debounce';
import { parseTemplateTags } from '@/lib/templateParser';
import { buildExtensions } from '@/lib/tiptap/extensions';
import { cn } from '@/lib/utils';
import type { TemplateField } from '@/types';

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
        const md = ed.getMarkdown();
        // Skip if content hasn't actually changed (prevents false isDirty from
        // Tiptap v3 markdown normalization or focus reconciliation)
        if (md === lastExternalContent.current) return;
        isLocalUpdate.current = true;
        onContentChangeRef.current(md);
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

  // ── Template variable popover state ──
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeField, setActiveField] = useState<TemplateField | null>(null);
  const [activeRange, setActiveRange] = useState<{ from: number; to: number } | null>(null);
  const popoverAnchorRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle clicks on template-tag decorations via event delegation
  const handleEditorClick = useCallback(
    (e: React.MouseEvent) => {
      if (!templateHighlight || !editable || !editor) return;

      const target = e.target as HTMLElement;
      const tagEl = target.closest('.template-tag');
      if (!tagEl) return;

      const from = Number(tagEl.getAttribute('data-tag-from'));
      const to = Number(tagEl.getAttribute('data-tag-to'));
      if (isNaN(from) || isNaN(to)) return;

      // Parse the tag text from the editor document
      const tagText = editor.state.doc.textBetween(from, to);
      const fields = parseTemplateTags(tagText);
      const field = fields[0] ?? null;

      // Position the invisible anchor near the clicked element
      if (popoverAnchorRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const tagRect = tagEl.getBoundingClientRect();
        popoverAnchorRef.current.style.position = 'absolute';
        popoverAnchorRef.current.style.left = `${tagRect.left - containerRect.left}px`;
        popoverAnchorRef.current.style.top = `${tagRect.bottom - containerRect.top}px`;
      }

      setActiveField(field);
      setActiveRange({ from, to });
      setPopoverOpen(true);
    },
    [templateHighlight, editable, editor]
  );

  const handlePopoverApply = useCallback(
    (tagString: string) => {
      if (!editor || !activeRange) return;
      editor
        .chain()
        .focus()
        .deleteRange({ from: activeRange.from, to: activeRange.to })
        .insertContentAt(activeRange.from, tagString)
        .run();
      setPopoverOpen(false);
    },
    [editor, activeRange]
  );

  const handlePopoverRemove = useCallback(() => {
    if (!editor || !activeRange) return;
    editor.chain().focus().deleteRange({ from: activeRange.from, to: activeRange.to }).run();
    setPopoverOpen(false);
  }, [editor, activeRange]);

  // Insert a new variable at cursor position
  const handleInsertVariable = useCallback(() => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const tagString = '{{variable}}';
    editor.chain().focus().insertContentAt(from, tagString).run();

    // After insertion, open popover for the newly inserted tag
    // Use a short timeout to let the decoration rebuild
    setTimeout(() => {
      const newFrom = from;
      const newTo = from + tagString.length;
      const fields = parseTemplateTags(tagString);

      if (popoverAnchorRef.current && containerRef.current) {
        // Position near cursor — approximate using editor DOM
        const view = editor.view;
        const coords = view.coordsAtPos(newFrom);
        const containerRect = containerRef.current.getBoundingClientRect();
        popoverAnchorRef.current.style.position = 'absolute';
        popoverAnchorRef.current.style.left = `${coords.left - containerRect.left}px`;
        popoverAnchorRef.current.style.top = `${coords.bottom - containerRect.top}px`;
      }

      setActiveField(fields[0] ?? null);
      setActiveRange({ from: newFrom, to: newTo });
      setPopoverOpen(true);
    }, 50);
  }, [editor]);

  return (
    <div
      ref={containerRef}
      role="textbox"
      tabIndex={0}
      className={cn(
        'relative rounded-md border border-border bg-elevated focus-within:ring-2 focus-within:ring-primary/30 transition-shadow',
        minHeightClass,
        className
      )}
      onClick={handleEditorClick}
    >
      {templateHighlight && editable && (
        <div className="flex justify-end px-2 pt-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={(e) => {
                  e.stopPropagation();
                  handleInsertVariable();
                }}
              >
                <Braces className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insert variable</TooltipContent>
          </Tooltip>
        </div>
      )}

      <EditorContent editor={editor} className="px-3 py-2" />
      {editable && editor && <EditorBubbleMenu editor={editor} />}

      {/* Invisible anchor for popover positioning */}
      <span ref={popoverAnchorRef} className="pointer-events-none" />

      {templateHighlight && (
        <VariableChipPopover
          field={activeField}
          onApply={handlePopoverApply}
          onRemove={handlePopoverRemove}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
        >
          <span ref={popoverAnchorRef} className="absolute pointer-events-none" />
        </VariableChipPopover>
      )}
    </div>
  );
}
