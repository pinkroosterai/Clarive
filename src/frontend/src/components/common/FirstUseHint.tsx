import { Lightbulb, X } from 'lucide-react';
import { useState } from 'react';

import { getDocsUrl } from '@/lib/docsUrl';

interface FirstUseHintProps {
  hintId: string;
  title: string;
  description: string;
  section?: string;
}

const STORAGE_PREFIX = 'cl_hint_';

export function FirstUseHint({ hintId, title, description, section }: FirstUseHintProps) {
  const storageKey = `${STORAGE_PREFIX}${hintId}_dismissed`;

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // localStorage unavailable — dismiss for this session only
    }
    setDismissed(true);
  };

  return (
    <div className="relative rounded-lg border border-primary/20 bg-primary/5 p-4 mb-4">
      <div className="flex gap-3">
        <Lightbulb className="size-4 shrink-0 text-primary mt-0.5" />
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-medium text-foreground mb-1">{title}</h5>
          <p className="text-xs text-foreground-muted leading-relaxed">{description}</p>
          {section && (
            <a
              href={getDocsUrl(section)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-xs text-primary hover:underline"
            >
              Learn more
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 text-foreground-muted hover:text-foreground transition-colors"
          aria-label="Dismiss hint"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
