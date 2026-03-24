import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { FavoriteEntry } from '@/types';

interface FavoritesListProps {
  entries: FavoriteEntry[];
  onUnfavorite?: (entryId: string) => void;
}

const badgeVariant: Record<string, { variant: 'published' | 'historical'; label: string }> = {
  tab: { variant: 'historical', label: 'Unpublished' },
  published: { variant: 'published', label: 'Published' },
  unpublished: { variant: 'historical', label: 'Unpublished' },
};

export const FavoritesList = memo(function FavoritesList({
  entries,
  onUnfavorite,
}: FavoritesListProps) {
  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border-subtle bg-surface elevation-1"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <Star className="size-4 text-yellow-500" />
        <h2 className="text-sm font-semibold text-foreground">Favorites</h2>
      </div>

      <div className="divide-y divide-border-subtle">
        {entries.map((entry, i) => {
          const badge = badgeVariant[entry.versionState] ?? {
            variant: 'historical' as const,
            label: entry.versionState,
          };
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.04, duration: 0.3 }}
              whileHover={{ x: 4, backgroundColor: 'hsl(var(--background-elevated))' }}
            >
              <div className="flex items-center gap-1 px-4 py-3 transition-colors">
                <Link
                  to={`/entry/${entry.id}`}
                  className="flex items-center justify-between gap-3 flex-1 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate" title={entry.title}>{entry.title}</p>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      Favorited{' '}
                      {formatDistanceToNow(new Date(entry.favoritedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant={badge.variant} className="shrink-0">
                    {badge.label}
                  </Badge>
                </Link>
                {onUnfavorite && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 ml-1"
                        aria-label="Remove from favorites"
                        onClick={() => onUnfavorite(entry.id)}
                      >
                        <Star className="size-3.5 fill-yellow-500 text-yellow-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove from favorites</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
});
