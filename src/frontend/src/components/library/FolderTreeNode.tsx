import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  MoreHorizontal,
  FolderPlus,
  Palette,
  Pencil,
  Trash2,
  FileText,
} from 'lucide-react';
import { memo, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { FolderColorPicker } from './FolderColorPicker';
import { InlineInput } from './InlineInput';

import { DragHandle } from '@/components/dnd/DragHandle';
import { useDndState } from '@/components/dnd/useDndState';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { draggableEntryId, draggableFolderId, droppableFolderId } from '@/lib/dnd/types';
import { getFolderColorClass } from '@/lib/folderColors';
import { cn } from '@/lib/utils';
import type { DraggableEntry } from '@/lib/dnd/types';
import type { Folder as FolderType } from '@/types';

export interface FolderActions {
  onCreate: (name: string, parentId: string | null) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetColor: (id: string, color: string | null) => void;
}

export const EntryTreeItem = memo(function EntryTreeItem({
  entry,
  depth,
  activeEntryId,
}: {
  entry: DraggableEntry;
  depth: number;
  activeEntryId: string | undefined;
}) {
  const navigate = useNavigate();
  const isActive = activeEntryId === entry.id;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableEntryId(entry.id, 'sidebar'),
    data: { type: 'entry', entry } as const,
  });

  return (
    <SidebarMenuItem>
      <div
        ref={setNodeRef}
        className={cn(
          'group/drag-item flex w-full items-center gap-1 rounded-md py-1 min-h-[44px] text-sm transition-colors duration-150',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
          isDragging && 'opacity-30'
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <DragHandle listeners={listeners} attributes={attributes} />
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5"
          onClick={() => navigate(`/entry/${entry.id}`)}
        >
          <FileText className="size-4 shrink-0 text-foreground-muted" />
          <span className="truncate">{entry.title}</span>
        </button>
      </div>
    </SidebarMenuItem>
  );
});

export const FolderTreeNode = memo(function FolderTreeNode({
  folder,
  depth,
  activeFolderId,
  activeEntryId,
  entries,
  entryCountMap,
  actions,
  expandedIds,
  onToggleExpand,
}: {
  folder: FolderType;
  depth: number;
  activeFolderId: string | undefined;
  activeEntryId: string | undefined;
  entries: DraggableEntry[];
  entryCountMap: Map<string | null, number>;
  actions: FolderActions;
  expandedIds: Set<string>;
  onToggleExpand: (folderId: string, expanded: boolean) => void;
}) {
  const navigate = useNavigate();
  const isOpen = expandedIds.has(folder.id);
  const setIsOpen = useCallback(
    (open: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof open === 'function' ? open(expandedIds.has(folder.id)) : open;
      onToggleExpand(folder.id, next);
    },
    [folder.id, expandedIds, onToggleExpand]
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [isCreatingChild, setIsCreatingChild] = useState(false);

  const isActive = activeFolderId === folder.id;
  const folderEntries = entries.filter((e) => e.folderId === folder.id);
  const hasChildren = folder.children.length > 0 || folderEntries.length > 0;
  const entryCount = entryCountMap.get(folder.id) ?? 0;

  const FolderIcon = isOpen ? FolderOpen : Folder;

  // -- Draggable (this folder as drag source) --
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: draggableFolderId(folder.id),
    data: { type: 'folder', folder } as const,
  });

  // -- Droppable (this folder as drop target) --
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: droppableFolderId(folder.id),
  });

  const { activeItem, isValidTarget } = useDndState();
  const showDropHighlight = isOver && activeItem !== null && isValidTarget(folder.id);

  // -- Merge draggable + droppable refs --
  const mergedRef = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  // -- Auto-expand on hover during drag --
  useEffect(() => {
    if (!isOver || !activeItem || isOpen) return;
    const timeout = setTimeout(() => setIsOpen(true), 500);
    return () => clearTimeout(timeout);
  }, [isOver, activeItem, isOpen]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SidebarMenuItem>
        <div
          ref={mergedRef}
          className={cn(
            'group/folder group/drag-item flex w-full items-center gap-1 rounded-md pr-1 min-h-[44px] transition-all duration-150',
            isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
            isDragging && 'opacity-30',
            showDropHighlight && 'ring-1 ring-primary/50 bg-primary/5 glow-brand-sm'
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <DragHandle listeners={dragListeners} attributes={dragAttributes} />

          <CollapsibleTrigger asChild>
            <button
              className="flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-sidebar-accent"
              onClick={(e) => e.stopPropagation()}
            >
              <ChevronRight
                className={cn(
                  'size-3.5 text-foreground-muted transition-transform duration-200',
                  isOpen && 'rotate-90',
                  !hasChildren && 'invisible'
                )}
              />
            </button>
          </CollapsibleTrigger>

          <button
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1 min-h-[44px] text-sm transition-colors duration-150"
            onClick={() => navigate(`/library/folder/${folder.id}`)}
          >
            {folder.color ? (
              <span className={cn('size-2.5 shrink-0 rounded-full', getFolderColorClass(folder.color))} />
            ) : (
              <FolderIcon className="size-4 shrink-0 text-foreground-muted" />
            )}
            {isRenaming ? (
              <InlineInput
                defaultValue={folder.name}
                onSubmit={(name) => {
                  actions.onRename(folder.id, name);
                  setIsRenaming(false);
                }}
                onCancel={() => setIsRenaming(false)}
              />
            ) : (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="truncate">{folder.name}</span>
                  </TooltipTrigger>
                  <TooltipContent side="right">{folder.name}</TooltipContent>
                </Tooltip>
                {entryCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto shrink-0 px-1.5 py-0 text-[10px] font-normal"
                  >
                    {entryCount}
                  </Badge>
                )}
              </>
            )}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex size-5 shrink-0 items-center justify-center rounded-sm opacity-0 hover:bg-sidebar-accent group-hover/folder:opacity-100 group-data-[collapsible=icon]:hidden">
                <MoreHorizontal className="size-3.5 text-foreground-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem
                onClick={() => {
                  setIsCreatingChild(true);
                  setIsOpen(true);
                }}
              >
                <FolderPlus className="mr-2 size-4" />
                New subfolder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                <Pencil className="mr-2 size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette className="mr-2 size-4" />
                  Set color
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <FolderColorPicker
                    currentColor={folder.color}
                    onSelect={(color) => actions.onSetColor(folder.id, color)}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                onClick={() => actions.onDelete(folder.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CollapsibleContent>
          {isCreatingChild && (
            <div style={{ paddingLeft: `${(depth + 1) * 12 + 4 + 20}px` }} className="py-0.5 pr-2">
              <InlineInput
                onSubmit={(name) => {
                  actions.onCreate(name, folder.id);
                  setIsCreatingChild(false);
                }}
                onCancel={() => setIsCreatingChild(false)}
              />
            </div>
          )}
          {folder.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              activeEntryId={activeEntryId}
              entries={entries}
              entryCountMap={entryCountMap}
              actions={actions}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
          {folderEntries.map((entry) => (
            <EntryTreeItem
              key={entry.id}
              entry={entry}
              depth={depth + 1}
              activeEntryId={activeEntryId}
            />
          ))}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
});
