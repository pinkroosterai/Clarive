import { useDraggable } from '@dnd-kit/core';
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  MessageSquare,
  FileCode,
  GitBranch,
  GripVertical,
} from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { draggableEntryId } from '@/lib/dnd/types';
import { parseTemplateTags } from '@/lib/templateParser';
import type { PromptEntry } from '@/types';

interface EntryCardProps {
  entry: PromptEntry;
  index?: number;
  onDuplicate: (entry: PromptEntry) => void;
  onTrash: (id: string) => void;
}

const badgeVariant: Record<
  string,
  { variant: 'draft' | 'published' | 'historical'; label: string }
> = {
  draft: { variant: 'draft', label: 'Draft' },
  published: { variant: 'published', label: 'Published' },
  historical: { variant: 'historical', label: '' },
};

export const EntryCard = memo(function EntryCard({
  entry,
  index = 0,
  onDuplicate,
  onTrash,
}: EntryCardProps) {
  const navigate = useNavigate();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableEntryId(entry.id, 'grid'),
    data: { type: 'entry', entry } as const,
  });

  const badge = badgeVariant[entry.versionState];
  const badgeLabel = badge.label || `v${entry.version}`;
  const preview = entry.firstPromptPreview ?? entry.prompts[0]?.content ?? '';

  const hasSystemMessage = entry.hasSystemMessage ?? entry.systemMessage !== null;
  const isTemplate =
    entry.isTemplate ?? entry.prompts.some((p) => parseTemplateTags(p.content).length > 0);
  const isChain = entry.isChain ?? entry.prompts.length > 1;
  const promptCount = entry.promptCount ?? entry.prompts.length;

  return (
    <Card
      ref={setNodeRef}
      className={`group relative cursor-pointer bg-card border-border-subtle rounded-xl elevation-2 transition-lift hover:elevation-3 hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/20 animate-slide-up opacity-0 ${isDragging ? 'opacity-30 scale-95' : ''}`}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
      onClick={() => {
        if (!isDragging) navigate(`/entry/${entry.id}`);
      }}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            className="flex shrink-0 items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 cursor-grab active:cursor-grabbing transition-opacity duration-150 touch-none"
            aria-label="Drag to move"
            onClick={(e) => e.stopPropagation()}
            {...listeners}
            {...attributes}
            tabIndex={0}
          >
            <GripVertical className="size-3.5 text-foreground-muted" />
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <CardTitle className="text-base font-medium leading-snug line-clamp-2">
                {entry.title}
              </CardTitle>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {entry.title}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={badge.variant}>{badgeLabel}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => navigate(`/entry/${entry.id}`)}>
                <Pencil className="size-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(entry)}>
                <Copy className="size-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onTrash(entry.id)}
              >
                <Trash2 className="size-4 mr-2" /> Move to trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <p className="text-sm text-foreground-secondary line-clamp-2">
          {preview || 'Empty prompt'}
        </p>
      </CardContent>

      <CardFooter className="gap-3 pt-0 pb-4">
        {hasSystemMessage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-foreground-muted">
                <MessageSquare className="size-4" />
                <span className="text-xs">System</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Has system message</TooltipContent>
          </Tooltip>
        )}
        {isTemplate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-foreground-muted">
                <FileCode className="size-4" />
                <span className="text-xs">Template</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Template prompt</TooltipContent>
          </Tooltip>
        )}
        {isChain && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 text-foreground-muted">
                <GitBranch className="size-4" />
                <span className="text-xs">Chain ({promptCount})</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Prompt chain ({promptCount} steps)</TooltipContent>
          </Tooltip>
        )}
      </CardFooter>
    </Card>
  );
});
