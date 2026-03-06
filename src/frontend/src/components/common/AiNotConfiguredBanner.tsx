import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

import { useAuthStore } from '@/store/authStore';

export function AiNotConfiguredBanner() {
  const [dismissed, setDismissed] = useState(false);
  const aiConfigured = useAuthStore((s) => s.aiConfigured);
  const currentUser = useAuthStore((s) => s.currentUser);

  if (aiConfigured || !currentUser?.isSuperUser || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-2 bg-warning-bg border-b border-warning-border px-4 py-2 text-sm text-warning-text">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <span>AI features are disabled — no API key is configured.</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-0.5 hover:bg-warning-bg transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
