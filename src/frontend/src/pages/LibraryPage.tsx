import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { EntryCard } from '@/components/library/EntryCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebounce } from '@/hooks/useDebounce';
import { handleApiError } from '@/lib/handleApiError';
import { entryService, folderService } from '@/services';
import type { PromptEntry } from '@/types';

type StatusFilter = 'all' | 'draft' | 'published';
type SortBy = 'recent' | 'alphabetical' | 'oldest';

const PAGE_SIZE = 50;

function filterAndSort(
  entries: PromptEntry[],
  search: string,
  status: StatusFilter,
  sort: SortBy
): PromptEntry[] {
  let result = entries;

  if (search) {
    const q = search.toLowerCase();
    result = result.filter((e) => e.title.toLowerCase().includes(q));
  }

  if (status !== 'all') {
    result = result.filter((e) => e.versionState === status);
  }

  return [...result].sort((a, b) => {
    switch (sort) {
      case 'alphabetical':
        return a.title.localeCompare(b.title);
      case 'oldest':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'recent':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });
}

function SkeletonCards() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-elevated skeleton-shimmer h-[180px] border border-border-subtle"
        />
      ))}
    </div>
  );
}

export default function LibraryPage() {
  const { folderId } = useParams<{ folderId: string }>();

  useEffect(() => {
    document.title = 'Clarive — Library';
  }, []);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset search and page when navigating to a different folder
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setPage(1);
  }, []);
  useEffect(() => {
    resetFilters();
  }, [folderId, resetFilters]);

  const { data, isLoading } = useQuery({
    queryKey: ['entries', folderId ?? null, page],
    queryFn: () => entryService.getEntriesList(folderId ?? null, page, PAGE_SIZE),
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

  const filtered = useMemo(
    () => (entries ? filterAndSort(entries, debouncedSearch, statusFilter, sortBy) : []),
    [entries, debouncedSearch, statusFilter, sortBy]
  );
  const pageItemCount = entries?.length ?? 0;
  const hasActiveFilters = debouncedSearch !== '' || statusFilter !== 'all';

  const trashMutation = useMutation({
    mutationFn: (id: string) => entryService.trashEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Moved to trash');
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const duplicateMutation = useMutation({
    mutationFn: (source: PromptEntry) =>
      entryService.createEntry({
        title: `${source.title} (copy)`,
        systemMessage: source.systemMessage,
        prompts: structuredClone(source.prompts),
        folderId: source.folderId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Entry duplicated');
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const handleDuplicate = useCallback(
    (e: PromptEntry) => duplicateMutation.mutate(e),
    [duplicateMutation]
  );

  const handleTrash = useCallback((id: string) => trashMutation.mutate(id), [trashMutation]);

  const heading = folderName ?? 'All Prompts';

  const emptyStateActions = (
    <>
      <Button onClick={() => navigate('/entry/new')}>
        <Plus className="size-4 mr-1.5" /> New Entry
      </Button>
      <Button variant="secondary" onClick={() => navigate('/entry/new/wizard')}>
        <Sparkles className="size-4 mr-1.5" /> AI Wizard
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <Button variant="secondary" onClick={() => navigate('/entry/new/wizard')}>
          <Sparkles className="size-4 mr-1.5" /> AI Wizard
        </Button>
      </div>

      {/* Search & Filter Bar */}
      {totalCount > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                <SelectItem value="draft">Draft</SelectItem>
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
          {hasActiveFilters && (
            <span className="text-sm text-foreground-muted whitespace-nowrap">
              {filtered.length} of {pageItemCount}
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <SkeletonCards />
      ) : totalCount === 0 ? (
        folderId ? (
          <EmptyState
            icon={FolderOpen}
            title="This folder is empty"
            description="Create a new entry or move existing entries to this folder."
            actions={emptyStateActions}
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No prompts yet"
            description="Create your first prompt entry or use the AI wizard to get started."
            actions={emptyStateActions}
          />
        )
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-foreground-muted">
          <Search className="mx-auto mb-3 size-8 opacity-40" />
          <p className="text-sm">No prompts match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
              />
            </div>
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
    </div>
  );
}
