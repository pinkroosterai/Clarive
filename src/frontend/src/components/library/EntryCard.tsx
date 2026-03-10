import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  MessageSquare,
  FileCode,
  GitBranch,
  GripVertical,
  Star,
} from 'lucide-react';
import { memo, useCallback } from 'react';
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
import * as favoriteService from '@/services/api/favoriteService';
import type { PromptEntry } from '@/types';

interface EntryCardProps {
  entry: PromptEntry;
  index?: number;
  onDuplicate: (entry: PromptEntry) => void;
  onTrash: (id: string) => void;
  onToggleFavorite?: (id: string, isFavorited: boolean) => void;
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
  onToggleFavorite,
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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        ref={setNodeRef}
        className={`group relative cursor-pointer bg-card border-border-subtle rounded-xl elevation-2 transition-lift hover:elevation-3 hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/20 ${isDragging ? 'opacity-30 scale-95' : ''}`}
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
            {onToggleFavorite && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(entry.id, !!entry.isFavorited);
                }}
              >
                <Star
                  className={`size-4 transition-colors ${entry.isFavorited ? 'fill-yellow-500 text-yellow-500' : 'text-foreground-muted'}`}
                />
              </Button>
            )}
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
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.tags.slice(0, 4).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {entry.tags.length > 4 && (
                <span className="text-xs text-foreground-muted">+{entry.tags.length - 4}</span>
              )}
            </div>
          )}
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
    </motion.div>
  );
});
