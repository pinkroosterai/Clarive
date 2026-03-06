import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
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
    return <LoadingSpinner />;
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
