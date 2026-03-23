import { AlertTriangle, ChevronDown, Loader2, Search, Send, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import ConfigSectionForm from './ConfigSectionForm';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { handleApiError } from '@/lib/handleApiError';
import type { ConfigSetting } from '@/services/api/configService';
import { sendTestEmail } from '@/services/api/configService';

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
  const [search, setSearch] = useState('');
  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const handleDirtyChange = useCallback((sectionKey: string, isDirty: boolean) => {
    setDirtySections((prev) => {
      const next = new Set(prev);
      if (isDirty) next.add(sectionKey);
      else next.delete(sectionKey);
      return next;
    });
  }, []);

  const emailProviderValue = useMemo(() => {
    const emailSettings = settingsBySection['email'] ?? [];
    const provider = emailSettings.find((s) => s.key === 'Email:Provider');
    return provider?.value ?? 'none';
  }, [settingsBySection]);

  const isEmailProviderConfigured = emailProviderValue !== 'none';

  const handleSendTestEmail = useCallback(async () => {
    setSendingTestEmail(true);
    try {
      const result = await sendTestEmail();
      toast.success(`Test email sent to ${result.email}`);
    } catch (err) {
      handleApiError(err, { title: 'Failed to send test email' });
    } finally {
      setSendingTestEmail(false);
    }
  }, []);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter settings by search term across all sections
  const filteredBySection = useMemo(() => {
    if (!search.trim()) return settingsBySection;
    const q = search.toLowerCase();
    const result: Record<string, ConfigSetting[]> = {};
    for (const [section, settings] of Object.entries(settingsBySection)) {
      const matched = settings.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.key.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
      if (matched.length > 0) result[section] = matched;
    }
    return result;
  }, [settingsBySection, search]);

  // Auto-expand sections with matches when searching
  const effectiveOpen = useMemo(() => {
    if (!search.trim()) return openSections;
    const expanded: Record<string, boolean> = {};
    for (const { key } of SETTINGS_SECTIONS) {
      expanded[key] = (filteredBySection[key]?.length ?? 0) > 0;
    }
    return expanded;
  }, [search, openSections, filteredBySection]);

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
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground-muted" />
        <Input
          placeholder="Search settings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-8"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-6"
            onClick={() => setSearch('')}
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      {SETTINGS_SECTIONS.map(({ key, label }) => {
        const sectionSettings = filteredBySection[key] ?? [];
        if (sectionSettings.length === 0 && search.trim()) return null;
        if ((settingsBySection[key] ?? []).length === 0) return null;

        const isOpen = effectiveOpen[key] ?? true;

        return (
          <Collapsible
            key={key}
            open={isOpen}
            onOpenChange={() => {
              if (!search.trim()) toggleSection(key);
            }}
          >
            <CollapsibleTrigger className="flex items-center gap-2 w-full group cursor-pointer">
              <ChevronDown
                className={`size-4 text-foreground-muted transition-transform ${
                  isOpen ? '' : '-rotate-90'
                }`}
              />
              <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
                {label}
              </h3>
              {dirtySections.has(key) && (
                <span className="size-2 rounded-full bg-primary animate-pulse" title="Unsaved changes" />
              )}
              <div className="flex-1 border-b border-border" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <ConfigSectionForm
                settings={sectionSettings}
                onSaved={onSaved}
                onDirtyChange={(isDirty) => handleDirtyChange(key, isDirty)}
              />
              {key === 'email' && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!isEmailProviderConfigured || sendingTestEmail}
                          onClick={handleSendTestEmail}
                        >
                          {sendingTestEmail ? (
                            <Loader2 className="size-4 mr-1.5 animate-spin" />
                          ) : (
                            <Send className="size-4 mr-1.5" />
                          )}
                          {sendingTestEmail ? 'Sending...' : 'Send Test Email'}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!isEmailProviderConfigured && (
                      <TooltipContent>Configure an email provider first</TooltipContent>
                    )}
                  </Tooltip>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {search.trim() && Object.keys(filteredBySection).length === 0 && (
        <p className="text-sm text-foreground-muted text-center py-8">
          No settings match &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  );
}
