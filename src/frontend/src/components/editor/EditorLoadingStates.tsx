import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function EditorError() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <h2 className="text-lg font-semibold">Failed to load entry</h2>
      <p className="text-sm text-foreground-muted">
        The entry may have been deleted or you may not have access.
      </p>
      <Button asChild variant="outline">
        <Link to="/library">Back to Library</Link>
      </Button>
    </div>
  );
}

export function EditorSkeleton({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_360px] gap-0">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20 rounded" />
          </div>
          <Skeleton className="size-8 rounded" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
      <div className="bg-surface border-l border-border-subtle p-4 space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-6 w-24 rounded" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-px w-full" />
        <Skeleton className="h-6 w-20 rounded" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
