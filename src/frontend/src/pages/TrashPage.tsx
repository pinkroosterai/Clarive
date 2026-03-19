import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Trash2, Undo2, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { HelpLink } from '@/components/common/HelpLink';
import { TrashPreviewSheet } from '@/components/library/TrashPreviewSheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { buildFolderMap } from '@/lib/folderUtils';
import { handleApiError } from '@/lib/handleApiError';
import { entryService, folderService } from '@/services';
import { useAuthStore } from '@/store/authStore';

const PAGE_SIZE = 50;

const TrashPage = () => {
  useEffect(() => {
    document.title = 'Clarive — Trash';
  }, []);
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAdmin = currentUser?.role === 'admin';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['trashedEntries', page],
    queryFn: () => entryService.getTrashedEntries(page, PAGE_SIZE),
  });

  const entries = data?.items;
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: folders } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
  });

  const folderMap = useMemo(() => (folders ? buildFolderMap(folders) : {}), [folders]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['trashedEntries'] });
    queryClient.invalidateQueries({ queryKey: ['entries'] });
  }, [queryClient]);

  const restoreMutation = useMutation({
    mutationFn: entryService.restoreEntry,
    onSuccess: () => invalidate(),
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to restore entry' }),
  });

  const deleteMutation = useMutation({
    mutationFn: entryService.permanentlyDeleteEntry,
    onSuccess: () => invalidate(),
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to delete entry' }),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!entries) return;
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const handleRestore = async (id: string, title: string) => {
    try {
      await restoreMutation.mutateAsync(id);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      setPreviewId((prev) => (prev === id ? null : prev));
      toast.success('Entry restored', { description: `"${title}" has been restored.` });
    } catch {
      // onError handler on the mutation displays the toast
    }
  };

  const handleDelete = async (id: string, title: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      setPreviewId((prev) => (prev === id ? null : prev));
      toast.success('Entry permanently deleted', {
        description: `"${title}" has been permanently deleted.`,
      });
    } catch {
      // onError handler on the mutation displays the toast
    }
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => restoreMutation.mutateAsync(id)));
    setSelectedIds(new Set());
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      toast.warning(`Restored ${ids.length - failed} of ${ids.length} entries`, {
        description: `${failed} failed to restore.`,
      });
    } else {
      toast.success('Entries restored', {
        description: `${ids.length} entries have been restored.`,
      });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => deleteMutation.mutateAsync(id)));
    setSelectedIds(new Set());
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      toast.warning(`Deleted ${ids.length - failed} of ${ids.length} entries`, {
        description: `${failed} failed to delete.`,
      });
    } else {
      toast.success('Entries permanently deleted', {
        description: `${ids.length} entries have been permanently deleted.`,
      });
    }
  };

  const isBusy = restoreMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Trash</h1>
        <HelpLink section="trash" />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-elevated border border-border-subtle elevation-2 px-4 py-2">
          <span className="bg-primary/12 text-primary rounded-full px-3 py-1 text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button size="sm" variant="outline" disabled={isBusy} onClick={handleBulkRestore}>
            <Undo2 className="mr-1 size-3.5" /> Restore
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={isBusy}>
                  <Trash2 className="mr-1 size-3.5" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Permanently delete {selectedIds.size} entries?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. All selected entries will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface p-4"
            >
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-4 w-24 ml-auto rounded hidden sm:block" />
              <Skeleton className="h-4 w-20 ml-2 rounded hidden md:block" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && totalCount === 0 && (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="Items you delete will appear here for 30 days before permanent removal."
          actions={
            <Link
              to="/help#trash"
              className="text-xs text-foreground-muted underline hover:text-foreground"
            >
              Learn more
            </Link>
          }
        />
      )}

      {/* Entry list */}
      {!isLoading && entries && entries.length > 0 && (
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center gap-4 px-4 py-2 text-xs font-medium text-foreground-muted uppercase tracking-wider bg-elevated/50 rounded-lg">
            <Checkbox
              checked={selectedIds.size === entries.length}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
            <span className="flex-1">Title</span>
            <span className="w-28 text-right hidden sm:block">Deleted</span>
            <span className="w-32 text-right hidden md:block">Folder</span>
            <span className="w-24" />
          </div>

          {entries.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.25 }}
              className="flex items-center gap-4 rounded-lg border border-border-subtle bg-surface hover:bg-elevated transition-colors border-l-2 border-l-destructive/30 px-4 py-3"
            >
              <Checkbox
                checked={selectedIds.has(entry.id)}
                onCheckedChange={() => toggleSelect(entry.id)}
                aria-label={`Select ${entry.title}`}
              />
              <button
                type="button"
                className="flex-1 min-w-0 font-medium truncate text-left cursor-pointer hover:text-primary transition-colors"
                onClick={() => setPreviewId(entry.id)}
                title={entry.title}
              >
                {entry.title}
              </button>
              <span className="w-28 text-right text-sm text-foreground-muted hidden sm:block">
                {format(new Date(entry.updatedAt), 'MMM d, yyyy')}
              </span>
              <span className="w-32 text-right text-sm text-foreground-muted items-center justify-end gap-1 hidden md:flex">
                <FolderOpen className="size-3.5" />
                {entry.folderId ? (folderMap[entry.folderId] ?? 'Unknown') : 'Root'}
              </span>
              <div className="flex items-center justify-end gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => handleRestore(entry.id, entry.title)}
                  title="Restore"
                  className="gap-1"
                >
                  <Undo2 className="size-4" />
                  <span className="hidden sm:inline">Restore</span>
                </Button>
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isBusy}
                        title="Permanently delete"
                        className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px]"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Permanently delete "{entry.title}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This entry will be permanently removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(entry.id, entry.title)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <span className="text-sm text-foreground-muted">
            Page {page} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <TrashPreviewSheet
        entryId={previewId}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null);
        }}
        onRestore={handleRestore}
        onDelete={handleDelete}
        isAdmin={isAdmin}
        isBusy={isBusy}
      />
    </div>
  );
};

export default TrashPage;
