import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, Globe, PenLine, FolderOpen, LayoutDashboard } from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { FavoritesList } from '@/components/dashboard/FavoritesList';
import { RecentEntriesList } from '@/components/dashboard/RecentEntriesList';
import { StatCard } from '@/components/dashboard/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardService } from '@/services';
import * as favoriteService from '@/services/api/favoriteService';
import { useAuthStore } from '@/store/authStore';

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const timeOfDay =
    hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';
  const firstName = name.split(' ')[0];
  return `Good ${timeOfDay}, ${firstName}`;
}

function getSubtitle(drafts: number, published: number): string {
  if (drafts === 0 && published === 0) return 'Create your first entry to get started.';
  if (drafts > 0) return `You have ${drafts} draft${drafts > 1 ? 's' : ''} pending review.`;
  return 'All entries are published.';
}

export default function DashboardPage() {
  useEffect(() => {
    document.title = 'Clarive \u2014 Dashboard';
  }, []);

  const currentUser = useAuthStore((s) => s.currentUser);
  const queryClient = useQueryClient();

  const unfavoriteMutation = useMutation({
    mutationFn: (entryId: string) => favoriteService.unfavoriteEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  const handleUnfavorite = useCallback(
    (entryId: string) => unfavoriteMutation.mutate(entryId),
    [unfavoriteMutation]
  );

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardService.getStats,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border-subtle bg-surface elevation-1">
            <Skeleton className="h-10 rounded-t-xl" />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 mx-4 my-2 rounded" />
            ))}
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface elevation-1">
            <Skeleton className="h-10 rounded-t-xl" />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 mx-4 my-2 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats || (stats.totalEntries === 0 && stats.recentEntries.length === 0)) {
    return (
      <div className="space-y-6">
        <GreetingHero name={currentUser?.name} subtitle="Create your first entry to get started." />
        <div data-tour="dashboard-stats" data-tour-empty="true">
          <EmptyState
            icon={LayoutDashboard}
            title="Welcome to Clarive"
            description="Create your first entry to get started. Your dashboard will show recent activity and stats once you do."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GreetingHero
        name={currentUser?.name}
        subtitle={getSubtitle(stats.draftEntries, stats.publishedEntries)}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="dashboard-stats">
        <StatCard icon={FileText} label="Entries" value={stats.totalEntries} index={0} />
        <StatCard icon={Globe} label="Published" value={stats.publishedEntries} index={1} />
        <StatCard icon={PenLine} label="Drafts" value={stats.draftEntries} index={2} />
        <StatCard icon={FolderOpen} label="Folders" value={stats.totalFolders} index={3} />
      </div>

      {stats.favoriteEntries && stats.favoriteEntries.length > 0 && (
        <FavoritesList entries={stats.favoriteEntries} onUnfavorite={handleUnfavorite} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-tour="dashboard-recent">
        <RecentEntriesList entries={stats.recentEntries} />
        <ActivityFeed activities={stats.recentActivity} />
      </div>
    </div>
  );
}

function GreetingHero({ name, subtitle }: { name?: string; subtitle: string }) {
  const greeting = name ? getGreeting(name) : 'Dashboard';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-border-subtle px-6 py-5"
    >
      <div className="absolute top-2 right-12 size-20 rounded-full bg-primary/8 blur-2xl" />
      <div className="absolute bottom-1 left-16 size-14 rounded-full bg-primary/6 blur-xl" />
      <div className="relative">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="mt-1 text-sm text-foreground-muted"
        >
          {subtitle}
        </motion.p>
      </div>
    </motion.div>
  );
}
