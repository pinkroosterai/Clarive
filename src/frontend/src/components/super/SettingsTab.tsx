import { ChevronDown } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import ConfigSectionForm from './ConfigSectionForm';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConfigSetting } from '@/services/api/configService';

interface SettingsTabProps {
  settingsBySection: Record<string, ConfigSetting[]>;
  configLoading: boolean;
  configError: boolean;
  onSaved: () => void;
}

const SETTINGS_SECTIONS = [
  { key: 'authentication', label: 'Authentication' },
  { key: 'email', label: 'Email' },
  { key: 'application', label: 'Application' },
] as const;

export default function SettingsTab({
  settingsBySection,
  configLoading,
  configError,
  onSaved,
}: SettingsTabProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SETTINGS_SECTIONS.map((s) => [s.key, true]))
  );

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (configLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (configError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertDescription>
          Failed to load configuration settings. Check that the backend is running and the database
          migration has been applied.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {SETTINGS_SECTIONS.map(({ key, label }) => {
        const sectionSettings = settingsBySection[key] ?? [];
        if (sectionSettings.length === 0) return null;

        return (
          <Collapsible key={key} open={openSections[key]} onOpenChange={() => toggleSection(key)}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full group cursor-pointer">
              <ChevronDown
                className={`size-4 text-foreground-muted transition-transform ${
                  openSections[key] ? '' : '-rotate-90'
                }`}
              />
              <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
                {label}
              </h3>
              <div className="flex-1 border-b border-border" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <ConfigSectionForm settings={sectionSettings} onSaved={onSaved} />
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
