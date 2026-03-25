import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function PlaygroundSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Page header skeleton */}
      <div className="px-4 pt-4 space-y-2">
        <Skeleton className="h-7 w-36 rounded" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-4 h-14">
        <Skeleton className="size-8 rounded" />
        <Skeleton className="h-5 w-40 rounded" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-3/4 rounded-lg" />
        <Skeleton className="mt-6 h-[300px] w-full rounded-xl" />
      </div>
    </div>
  );
}

export function PlaygroundError() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-foreground-muted">Entry not found.</p>
      <Button variant="outline" asChild>
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
