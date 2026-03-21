import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Library, Plus, Search, X, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useState, useMemo, useDeferredValue, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { FolderTreeNode, EntryTreeItem } from './FolderTreeNode';
import type { FolderActions } from './FolderTreeNode';
import { InlineInput } from './InlineInput';

import { DroppableFolderWrapper } from '@/components/dnd/DroppableFolderWrapper';
import { Input } from '@/components/ui/input';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { buildRecursiveCountMap, collectAllFolderIds, filterFolderTree } from '@/lib/folderUtils';
import { folderService, entryService } from '@/services';
import type { PromptEntry } from '@/types';

/** Build a map of folderId -> number of entries directly inside it. */
function buildEntryCountMap(entries: PromptEntry[]): Map<string | null, number> {
  const map = new Map<string | null, number>();
  for (const e of entries) {
    map.set(e.folderId, (map.get(e.folderId) ?? 0) + 1);
  }
  return map;
}

export function FolderTree() {
  const navigate = useNavigate();
  const { folderId, entryId } = useParams();
  const queryClient = useQueryClient();
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const deferredQuery = useDeferredValue(filterQuery);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggleExpand = useCallback((folderId: string, expanded: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(folderId);
      else next.delete(folderId);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(
    () => setExpandedIds(collectAllFolderIds(folders)),
    [folders]
  );
  const handleCollapseAll = useCallback(() => setExpandedIds(new Set()), []);

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
  });

  const { data: entriesData } = useQuery({
    queryKey: ['entries', null, 1],
    queryFn: () => entryService.getEntriesList(null, 1, 1000),
    staleTime: 60_000, // avoid refetching on every navigation — 1 min cache
  });
  const entries = useMemo(() => entriesData?.items ?? [], [entriesData]);

  const rootEntries = useMemo(() => entries.filter((e) => e.folderId === null), [entries]);
  const directCountMap = useMemo(() => buildEntryCountMap(entries), [entries]);
  const entryCountMap = useMemo(
    () => buildRecursiveCountMap(folders, directCountMap),
    [folders, directCountMap]
  );

  const isFiltering = deferredQuery.trim().length > 0;
  const filteredFolders = useMemo(
    () => filterFolderTree(folders, deferredQuery),
    [folders, deferredQuery]
  );

  const invalidateFolders = () => queryClient.invalidateQueries({ queryKey: ['folders'] });

  const createMutation = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId?: string | null }) =>
      folderService.createFolder(name, parentId),
    onSuccess: () => {
      invalidateFolders();
      toast.success('Folder created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      folderService.renameFolder(id, name),
    onSuccess: () => {
      invalidateFolders();
      toast.success('Folder renamed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => folderService.deleteFolder(id),
    onSuccess: () => {
      invalidateFolders();
      toast.success('Folder deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setColorMutation = useMutation({
    mutationFn: ({ id, color }: { id: string; color: string | null }) =>
      folderService.setFolderColor(id, color),
    onSuccess: () => {
      invalidateFolders();
      toast.success('Folder color updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const folderActions: FolderActions = useMemo(
    () => ({
      onCreate: (name: string, parentId: string | null) =>
        createMutation.mutate({ name, parentId }),
      onRename: (id: string, name: string) => renameMutation.mutate({ id, name }),
      onDelete: (id: string) => deleteMutation.mutate(id),
      onSetColor: (id: string, color: string | null) => setColorMutation.mutate({ id, color }),
    }),
    [createMutation, renameMutation, deleteMutation, setColorMutation]
  );

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:hidden">
      {/* Folder search & expand/collapse controls */}
      {folders.length > 0 && (
        <div className="flex items-center gap-1 px-2 pb-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-foreground-muted pointer-events-none" />
            <Input
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter folders…"
              className="h-7 pl-7 pr-7 text-xs"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleExpandAll}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <ChevronsUpDown className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Expand all</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleCollapseAll}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <ChevronsDownUp className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Collapse all</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* All Prompts */}
      <DroppableFolderWrapper folderId={null}>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => navigate('/library')}
            isActive={!folderId && !entryId}
            tooltip="All Prompts"
          >
            <Library className="size-4" />
            <span>All Prompts</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </DroppableFolderWrapper>

      {/* Root-level entries (hidden when filtering) */}
      {!isFiltering &&
        rootEntries.map((entry) => (
          <EntryTreeItem key={entry.id} entry={entry} depth={0} activeEntryId={entryId} />
        ))}

      {/* No matches empty state */}
      {isFiltering && filteredFolders.length === 0 && (
        <p className="px-3 py-2 text-xs text-foreground-muted">No folders match &ldquo;{deferredQuery}&rdquo;</p>
      )}

      {/* Folder tree */}
      {filteredFolders.map((folder) => (
        <FolderTreeNode
          key={folder.id}
          folder={folder}
          depth={0}
          activeFolderId={folderId}
          activeEntryId={entryId}
          entries={entries}
          entryCountMap={entryCountMap}
          actions={folderActions}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
        />
      ))}

      {/* New folder inline input */}
      {isCreatingRoot && (
        <div className="px-2 py-0.5">
          <InlineInput
            onSubmit={(name) => {
              createMutation.mutate({ name, parentId: null });
              setIsCreatingRoot(false);
            }}
            onCancel={() => setIsCreatingRoot(false)}
          />
        </div>
      )}

      {/* New folder button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => setIsCreatingRoot(true)}
          className="text-foreground-muted hover:text-foreground transition-colors duration-150"
        >
          <Plus className="size-4" />
          <span>New folder</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
