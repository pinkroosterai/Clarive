import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WizardContent } from '@/components/wizard/WizardContent';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { entryService } from '@/services';

const EnhanceWizardPage = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const aiEnabled = useAiEnabled();

  useEffect(() => {
    document.title = 'Clarive — AI Enhance';
  }, []);

  useEffect(() => {
    if (!aiEnabled) {
      toast.error('AI features are not configured.');
      navigate(entryId ? `/entry/${entryId}` : '/library', { replace: true });
    }
  }, [aiEnabled, navigate, entryId]);

  const {
    data: entry,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => entryService.getEntry(entryId!),
    enabled: !!entryId && aiEnabled,
  });

  if (!aiEnabled) return null;

  if (isError) {
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

  if (isLoading || !entry) {
    return (
      <div className="flex h-full flex-col">
        {/* Header skeleton */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <Skeleton className="h-6 w-32 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
          <Skeleton className="size-8 rounded" />
        </div>
        {/* Content skeleton */}
        <div className="flex-1 flex items-start justify-center p-8">
          <div className="w-full max-w-2xl space-y-6">
            <Skeleton className="h-8 w-64 rounded" />
            <Skeleton className="h-4 w-96 rounded" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <WizardContent
      mode="enhance"
      existingEntry={entry}
      onClose={() => navigate(`/entry/${entryId}`)}
    />
  );
};

export default EnhanceWizardPage;
