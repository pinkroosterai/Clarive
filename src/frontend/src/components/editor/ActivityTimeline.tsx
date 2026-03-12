import { useInfiniteQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { memo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import * as activityService from '@/services/api/activityService';

const PAGE_SIZE = 20;

const actionLabels: Record<string, string> = {
  entry_created: 'Created',
  entry_draft_updated: 'Draft updated',
  entry_published: 'Published',
  entry_trashed: 'Moved to trash',
  entry_restored: 'Restored',
  entry_deleted: 'Deleted',
  version_promoted: 'Version restored',
};

const actionColors: Record<string, string> = {
  entry_created: 'bg-green-500',
  entry_draft_updated: 'bg-blue-500',
  entry_published: 'bg-primary',
  entry_trashed: 'bg-orange-500',
  entry_restored: 'bg-emerald-500',
  entry_deleted: 'bg-destructive',
  version_promoted: 'bg-violet-500',
};

interface ActivityTimelineProps {
  entryId: string;
}

export const ActivityTimeline = memo(function ActivityTimeline({ entryId }: ActivityTimelineProps) {
  const navigate = useNavigate();

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['entry-activity', entryId],
    queryFn: ({ pageParam }) => activityService.getEntryActivity(entryId, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loadedSoFar = lastPage.page * lastPage.pageSize;
      return loadedSoFar < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-2 pt-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 rounded" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-xs text-foreground-muted pt-2 pb-1">No activity recorded yet.</p>;
  }

  return (
    <div className="relative space-y-0 pt-1">
      <div className="absolute left-[7px] top-3 bottom-2 w-px bg-border-subtle" />

      {items.map((item, i) => {
        const label = actionLabels[item.action] ?? item.action;
        const dotColor = actionColors[item.action] ?? 'bg-foreground-muted';
        const isVersionEvent =
          item.version != null &&
          (item.action === 'entry_published' || item.action === 'version_promoted');

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03, duration: 0.25 }}
            className="relative flex items-start gap-3 py-1.5 pl-5"
          >
            <div
              className={`absolute left-[4px] top-[10px] size-[7px] rounded-full ${dotColor} ring-2 ring-surface`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  {label}
                  {item.version != null && ` v${item.version}`}
                </span>
                {isVersionEvent && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => navigate(`/entry/${entryId}/version/${item.version}`)}
                  >
                    View
                  </button>
                )}
              </div>
              <p className="text-xs text-foreground-muted">
                {item.userName} &middot;{' '}
                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
              </p>
            </div>
          </motion.div>
        );
      })}

      {hasNextPage && (
        <div className="pl-5 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? 'Loading...' : 'Show more'}
          </Button>
        </div>
      )}
    </div>
  );
});
