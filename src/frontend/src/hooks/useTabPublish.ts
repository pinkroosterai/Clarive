import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import type { PromptEntry } from '@/types';

interface UseTabPublishOptions {
  localEntry: PromptEntry | null;
  handlePublish: () => void;
}

export function useTabPublish({ localEntry, handlePublish }: UseTabPublishOptions) {
  const [showEmptyPublishWarning, setShowEmptyPublishWarning] = useState(false);

  const handlePublishWithCheck = useCallback(() => {
    if (!localEntry?.title?.trim()) {
      toast.error('Title is required to publish');
      return;
    }
    const allEmpty = localEntry?.prompts?.every((p) => !p.content?.trim());
    if (allEmpty) {
      setShowEmptyPublishWarning(true);
    } else {
      handlePublish();
    }
  }, [localEntry, handlePublish]);

  return {
    showEmptyPublishWarning,
    setShowEmptyPublishWarning,
    handlePublishWithCheck,
  };
}
