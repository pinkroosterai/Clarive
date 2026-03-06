import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonProps) {
  return <div className={cn('h-[180px] rounded-xl animate-pulse bg-muted', className)} />;
}

export function SkeletonRow({ className }: SkeletonProps) {
  return <div className={cn('h-12 rounded-lg animate-pulse bg-muted', className)} />;
}

interface SkeletonPageProps {
  cards?: number;
  className?: string;
}

export function SkeletonPage({ cards = 6, className }: SkeletonPageProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: cards }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
