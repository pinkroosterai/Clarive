import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Library, Plus } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { FolderTreeNode, EntryTreeItem } from './FolderTreeNode';
import type { FolderActions } from './FolderTreeNode';
import { InlineInput } from './InlineInput';

import { DroppableFolderWrapper } from '@/components/dnd/DroppableFolderWrapper';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
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

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
  });

  const { data: entriesData } = useQuery({
    queryKey: ['entries', null, 1],
    queryFn: () => entryService.getEntriesList(null, 1, 1000),
  });
  const entries = entriesData?.items ?? [];

  const rootEntries = useMemo(() => entries.filter((e) => e.folderId === null), [entries]);
  const entryCountMap = useMemo(() => buildEntryCountMap(entries), [entries]);

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

  const folderActions: FolderActions = useMemo(
    () => ({
      onCreate: (name: string, parentId: string | null) =>
        createMutation.mutate({ name, parentId }),
      onRename: (id: string, name: string) => renameMutation.mutate({ id, name }),
      onDelete: (id: string) => deleteMutation.mutate(id),
    }),
    [createMutation, renameMutation, deleteMutation]
  );

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:hidden">
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

      {/* Root-level entries */}
      {rootEntries.map((entry) => (
        <EntryTreeItem key={entry.id} entry={entry} depth={0} activeEntryId={entryId} />
      ))}

      {/* Folder tree */}
      {folders.map((folder) => (
        <FolderTreeNode
          key={folder.id}
          folder={folder}
          depth={0}
          activeFolderId={folderId}
          activeEntryId={entryId}
          entries={entries}
          entryCountMap={entryCountMap}
          actions={folderActions}
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
