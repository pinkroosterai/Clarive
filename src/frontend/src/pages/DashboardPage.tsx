import { useQuery } from '@tanstack/react-query';
import { FileText, Globe, PenLine, FolderOpen, LayoutDashboard } from 'lucide-react';
import { useEffect } from 'react';

import { EmptyState } from '@/components/common/EmptyState';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { RecentEntriesList } from '@/components/dashboard/RecentEntriesList';
import { StatCard } from '@/components/dashboard/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardService } from '@/services';
import { useAuthStore } from '@/store/authStore';

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const timeOfDay =
    hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';
  const firstName = name.split(' ')[0];
  return `Good ${timeOfDay}, ${firstName}`;
}

export default function DashboardPage() {
  useEffect(() => {
    document.title = 'Clarive — Dashboard';
  }, []);

  const currentUser = useAuthStore((s) => s.currentUser);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardService.getStats,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {currentUser ? getGreeting(currentUser.name) : 'Dashboard'}
        </h1>
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
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {currentUser ? getGreeting(currentUser.name) : 'Dashboard'}
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="dashboard-stats">
        <StatCard icon={FileText} label="Entries" value={stats.totalEntries} />
        <StatCard icon={Globe} label="Published" value={stats.publishedEntries} />
        <StatCard icon={PenLine} label="Drafts" value={stats.draftEntries} />
        <StatCard icon={FolderOpen} label="Folders" value={stats.totalFolders} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-tour="dashboard-recent">
        <RecentEntriesList entries={stats.recentEntries} />
        <ActivityFeed activities={stats.recentActivity} />
      </div>
    </div>
  );
}
