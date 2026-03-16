import { AlertTriangle } from 'lucide-react';

import AiConfigSection from './AiConfigSection';
import AiProvidersSection from './AiProvidersSection';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConfigSetting } from '@/services/api/configService';

interface AiTabProps {
  aiSettings: ConfigSetting[];
  configLoading: boolean;
  configError: boolean;
  onSaved: () => void;
}

export default function AiTab({ aiSettings, configLoading, configError, onSaved }: AiTabProps) {
  return (
    <div className="space-y-8">
      {/* Section 1: Providers & Models */}
      <div>
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
            Providers & Models
          </h3>
          <p className="text-xs text-foreground-muted mt-1">
            Manage AI providers and configure which models are available.
          </p>
        </div>
        <AiProvidersSection />
      </div>

      <Separator />

      {/* Section 2: Configuration */}
      <div>
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
            Configuration
          </h3>
          <p className="text-xs text-foreground-muted mt-1">
            Set API keys, select default models, and configure playground access.
          </p>
        </div>
        {configLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : configError ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              Failed to load AI configuration. Check that the backend is running.
            </AlertDescription>
          </Alert>
        ) : aiSettings.length > 0 ? (
          <AiConfigSection settings={aiSettings} onSaved={onSaved} />
        ) : (
          <p className="text-sm text-foreground-muted">No AI settings configured.</p>
        )}
      </div>
    </div>
  );
}
