import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus,
  Sparkles,
  FileText,
  Search,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getDocsUrl } from '@/lib/docsUrl';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { HelpLink } from '@/components/common/HelpLink';
import { EntryCard } from '@/components/library/EntryCard';
import { FolderBreadcrumb } from '@/components/library/FolderBreadcrumb';
import { FolderPickerDialog } from '@/components/library/FolderPickerDialog';
import { TagFilter } from '@/components/library/TagFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { useDebounce } from '@/hooks/useDebounce';
import { useDuplicateEntry } from '@/hooks/useDuplicateEntry';
import { handleApiError } from '@/lib/handleApiError';
import { entryService, folderService } from '@/services';
import * as favoriteService from '@/services/api/favoriteService';
import type { PromptEntry } from '@/types';

type StatusFilter = 'all' | 'unpublished' | 'published';
type SortBy = 'recent' | 'alphabetical' | 'oldest';

const PAGE_SIZE = 50;

function SkeletonCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="rounded-xl bg-elevated skeleton-shimmer h-[180px] border border-border-subtle"
        />
      ))}
    </div>
  );
}

export default function LibraryPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const aiEnabled = useAiEnabled();

  useEffect(() => {
    document.title = 'Clarive \u2014 Library';
  }, []);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [page, setPage] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'and' | 'or'>('or');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sortBy, selectedTags, tagMode]);

  // Reset search and page when navigating to a different folder
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setPage(1);
  }, []);
  useEffect(() => {
    resetFilters();
  }, [folderId, resetFilters]);

  const { data, isLoading } = useQuery({
    queryKey: [
      'entries',
      folderId ?? null,
      page,
      selectedTags,
      tagMode,
      debouncedSearch,
      statusFilter,
      sortBy,
    ],
    queryFn: () =>
      entryService.getEntriesList(
        folderId ?? null,
        page,
        PAGE_SIZE,
        selectedTags.length > 0 ? selectedTags : undefined,
        selectedTags.length > 0 ? tagMode : undefined,
        debouncedSearch || undefined,
        statusFilter !== 'all' ? statusFilter : undefined,
        sortBy !== 'recent' ? sortBy : undefined
      ),
  });

  const entries = data?.items;
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const { data: folders } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
    enabled: !!folderId,
  });

  const folderName = useMemo(() => {
    if (!folderId || !folders) return null;
    const find = (list: typeof folders): string | null => {
      for (const f of list) {
        if (f.id === folderId) return f.name;
        const found = find(f.children);
        if (found) return found;
      }
      return null;
    };
    return find(folders);
  }, [folderId, folders]);

  const filtered = entries ?? [];
  const hasActiveFilters = debouncedSearch !== '' || statusFilter !== 'all';

  const trashMutation = useMutation({
    mutationFn: (id: string) => entryService.trashEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Moved to trash');
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const { startDuplicate, confirmDuplicate, cancelDuplicate, folderPickerState, isDuplicating } =
    useDuplicateEntry();

  const favoriteMutation = useMutation({
    mutationFn: ({ id, isFavorited }: { id: string; isFavorited: boolean }) =>
      isFavorited ? favoriteService.unfavoriteEntry(id) : favoriteService.favoriteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const handleDuplicate = useCallback(
    (e: PromptEntry) => startDuplicate(e),
    [startDuplicate]
  );

  const handleTrash = useCallback((id: string) => trashMutation.mutate(id), [trashMutation]);

  const handleToggleFavorite = useCallback(
    (id: string, isFavorited: boolean) => favoriteMutation.mutate({ id, isFavorited }),
    [favoriteMutation]
  );

  const heading = folderName ?? 'All Prompts';

  const emptyStateActions = (
    <>
      <Button onClick={() => navigate('/entry/new')}>
        <Plus className="size-4 mr-1.5" /> New Entry
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="secondary"
              onClick={() => navigate('/entry/new/wizard')}
              disabled={!aiEnabled}
            >
              <Sparkles className="size-4 mr-1.5" /> AI Wizard
            </Button>
          </span>
        </TooltipTrigger>
        {!aiEnabled && <TooltipContent>AI features are not configured</TooltipContent>}
      </Tooltip>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
          <HelpLink section="library" />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="secondary"
                onClick={() => navigate('/entry/new/wizard')}
                disabled={!aiEnabled}
              >
                <Sparkles className="size-4 mr-1.5" /> AI Wizard
              </Button>
            </span>
          </TooltipTrigger>
          {!aiEnabled && <TooltipContent>AI features are not configured</TooltipContent>}
        </Tooltip>
      </motion.div>

      {/* Breadcrumb trail */}
      {folderId && folders && <FolderBreadcrumb folderId={folderId} folders={folders} />}

      {/* Search & Filter Bar */}
      {(totalCount > 0 || hasActiveFilters) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" />
            <Input
              placeholder="Search prompts…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[130px] bg-elevated border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="unpublished">Unpublished</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-[140px] bg-elevated border-border">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="alphabetical">Alphabetical</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TagFilter
            selectedTags={selectedTags}
            tagMode={tagMode}
            onTagsChange={setSelectedTags}
            onTagModeChange={setTagMode}
          />
          <AnimatePresence>
            {hasActiveFilters && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-sm text-foreground-muted whitespace-nowrap"
              >
                {totalCount} result{totalCount !== 1 ? 's' : ''}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {isLoading ? (
        <SkeletonCards />
      ) : totalCount === 0 ? (
        folderId ? (
          <EmptyState
            icon={FolderOpen}
            title="This folder is empty"
            description="Create a new entry or move existing entries to this folder."
            actions={
              <>
                {emptyStateActions}
                <a
                  href={getDocsUrl('folders')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-foreground-muted underline hover:text-foreground"
                >
                  Learn more about folders
                </a>
              </>
            }
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No prompts yet"
            description="Create your first prompt entry or use the AI wizard to get started."
            actions={
              <>
                {emptyStateActions}
                <a
                  href={getDocsUrl('getting-started')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-foreground-muted underline hover:text-foreground"
                >
                  Learn more
                </a>
              </>
            }
          />
        )
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="py-12 text-center text-foreground-muted"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Search className="mx-auto mb-3 size-8" />
          </motion.div>
          <p className="text-sm">No prompts match your filters.</p>
        </motion.div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((entry, index) => (
              <div
                key={entry.id}
                {...(index === 0 ? { 'data-tour': 'entry-card', 'data-entry-id': entry.id } : {})}
              >
                <EntryCard
                  entry={entry}
                  index={index}
                  onDuplicate={handleDuplicate}
                  onTrash={handleTrash}
                  onToggleFavorite={handleToggleFavorite}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="flex items-center justify-between border-t border-border-subtle pt-4"
        >
          <span className="text-sm text-foreground-muted">
            Page {page} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex gap-2">
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-4 mr-1" /> Previous
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="size-4 ml-1" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}

      <FolderPickerDialog
        open={folderPickerState.open}
        onOpenChange={(open) => {
          if (!open) cancelDuplicate();
        }}
        onSelect={confirmDuplicate}
      />
    </div>
  );
}
