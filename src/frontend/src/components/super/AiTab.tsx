import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import AiConfigSection from './AiConfigSection';
import AiProvidersSection from './AiProvidersSection';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConfigSetting } from '@/services/api/configService';

interface AiTabProps {
  aiSettings: ConfigSetting[];
  configLoading: boolean;
  configError: boolean;
  onSaved: () => void;
}

export default function AiTab({ aiSettings, configLoading, configError, onSaved }: AiTabProps) {
  const [providersOpen, setProvidersOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);

  return (
    <div className="space-y-6">
      {/* Section 1: Providers & Models */}
      <Collapsible open={providersOpen} onOpenChange={setProvidersOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full group cursor-pointer">
          <ChevronDown
            className={`size-4 text-foreground-muted transition-transform ${
              providersOpen ? '' : '-rotate-90'
            }`}
          />
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
            Providers & Models
          </h3>
          <div className="flex-1 border-b border-border" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <AiProvidersSection />
        </CollapsibleContent>
      </Collapsible>

      {/* Section 2: Configuration */}
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full group cursor-pointer">
          <ChevronDown
            className={`size-4 text-foreground-muted transition-transform ${
              configOpen ? '' : '-rotate-90'
            }`}
          />
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
            Configuration
          </h3>
          <div className="flex-1 border-b border-border" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          {configLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-48 w-full rounded-lg" />
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
