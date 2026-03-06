import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RotateCcw,
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Minus,
  Save,
  Server,
  Database,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { handleApiError } from '@/lib/handleApiError';
import { cn } from '@/lib/utils';
import { setConfigValue, resetConfigValue, type ConfigSetting } from '@/services/api/configService';

const RESTART_STORAGE_KEY = 'cl_pending_restart_keys';

function addRestartKey(key: string) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(RESTART_STORAGE_KEY) || '[]') as string[];
    if (!existing.includes(key)) {
      existing.push(key);
      sessionStorage.setItem(RESTART_STORAGE_KEY, JSON.stringify(existing));
    }
  } catch {
    sessionStorage.setItem(RESTART_STORAGE_KEY, JSON.stringify([key]));
  }
}

interface ConfigSectionFormProps {
  settings: ConfigSetting[];
  onSaved: () => void;
}

export default function ConfigSectionForm({ settings, onSaved }: ConfigSectionFormProps) {
  const queryClient = useQueryClient();
  const [dirtyValues, setDirtyValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const resetMutation = useMutation({
    mutationFn: (key: string) => resetConfigValue(key),
    onSuccess: (_data, key) => {
      toast.success(`Reset to default: ${settings.find((s) => s.key === key)?.label ?? key}`);
      setDirtyValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['super', 'config'] });
    },
    onError: (err) => handleApiError(err, { fallback: 'Failed to reset setting' }),
  });

  const getEffectiveValue = useCallback(
    (key: string): string | null => {
      if (dirtyValues[key] !== undefined) return dirtyValues[key];
      const setting = settings.find((s) => s.key === key);
      return setting?.value ?? null;
    },
    [dirtyValues, settings]
  );

  const isVisible = useCallback(
    (setting: ConfigSetting): boolean => {
      if (!setting.visibleWhen) return true;
      const effectiveValue = getEffectiveValue(setting.visibleWhen.key);
      return setting.visibleWhen.values.includes(effectiveValue ?? '');
    },
    [getEffectiveValue]
  );

  const handleChange = (
    key: string,
    newValue: string,
    originalValue: string | null,
    isSecret: boolean
  ) => {
    if (!isSecret && newValue === (originalValue ?? '')) {
      setDirtyValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else if (isSecret && newValue === '') {
      setDirtyValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setDirtyValues((prev) => {
        const next = { ...prev, [key]: newValue };
        // Clear dirty values for fields that become hidden due to this change
        for (const s of settings) {
          if (s.visibleWhen?.key === key && !s.visibleWhen.values.includes(newValue)) {
            delete next[s.key];
          }
        }
        return next;
      });
    }
  };

  const hasDirty = Object.keys(dirtyValues).length > 0;

  const handleSave = async () => {
    if (!hasDirty) return;
    setSaving(true);
    let savedCount = 0;
    let hadRestartRequired = false;

    try {
      for (const [key, value] of Object.entries(dirtyValues)) {
        const result = await setConfigValue(key, value);
        savedCount++;
        if (result.requiresRestart) {
          hadRestartRequired = true;
          addRestartKey(key);
        }
      }

      setDirtyValues({});
      queryClient.invalidateQueries({ queryKey: ['super', 'config'] });

      if (hadRestartRequired) {
        toast.success(
          `${savedCount} setting${savedCount > 1 ? 's' : ''} saved. Some changes require a restart to take effect.`,
          { duration: 6000 }
        );
      } else {
        toast.success(`${savedCount} setting${savedCount > 1 ? 's' : ''} saved`);
      }

      onSaved();
    } catch (err) {
      handleApiError(err, { fallback: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  // Group visible settings by subGroup
  const groups = useMemo(() => {
    const visible = settings.filter(isVisible);
    const result: { label: string | null; settings: ConfigSetting[] }[] = [];
    let currentGroup: string | null = null;
    let currentSettings: ConfigSetting[] = [];

    for (const setting of visible) {
      if (setting.subGroup !== currentGroup) {
        if (currentSettings.length > 0) {
          result.push({ label: currentGroup, settings: currentSettings });
        }
        currentGroup = setting.subGroup;
        currentSettings = [setting];
      } else {
        currentSettings.push(setting);
      }
    }
    if (currentSettings.length > 0) {
      result.push({ label: currentGroup, settings: currentSettings });
    }
    return result;
  }, [settings, isVisible]);

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <div key={group.label ?? gi}>
          {group.label && (
            <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider mb-3 border-b border-border pb-2">
              {group.label}
            </h3>
          )}
          <div className="space-y-1">
            {group.settings.map((setting, index) => (
              <div key={setting.key}>
                {index > 0 && <Separator className="my-4" />}
                <ConfigField
                  setting={setting}
                  dirtyValue={dirtyValues[setting.key]}
                  onChange={(value) =>
                    handleChange(setting.key, value, setting.value, setting.isSecret)
                  }
                  onReset={() => resetMutation.mutate(setting.key)}
                  isResetting={resetMutation.isPending && resetMutation.variables === setting.key}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="pt-4">
        <Button onClick={handleSave} disabled={!hasDirty || saving} size="sm">
          <Save className="size-4 mr-1.5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

interface ConfigFieldProps {
  setting: ConfigSetting;
  dirtyValue: string | undefined;
  onChange: (value: string) => void;
  onReset: () => void;
  isResetting: boolean;
}

function ConfigField({ setting, dirtyValue, onChange, onReset, isResetting }: ConfigFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{setting.label}</Label>
        {setting.requiresRestart && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-warning-text border-warning-border gap-1 text-xs"
                >
                  <AlertTriangle className="size-3" />
                  Restart
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Requires application restart to take effect</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <SourceBadge source={setting.source} />
      </div>

      <p className="text-xs text-foreground-muted">{setting.description}</p>

      <div className="flex items-center gap-2">
        <ConfigInput setting={setting} dirtyValue={dirtyValue} onChange={onChange} />

        {setting.source === 'dashboard' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  disabled={isResetting}
                  className="shrink-0"
                >
                  <RotateCcw className={`size-4 ${isResetting ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove dashboard override and revert to environment default</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {setting.validationHint && !setting.isSecret && setting.inputType === 'text' && (
        <p className="text-xs text-foreground-muted/70">{setting.validationHint}</p>
      )}
    </div>
  );
}

// ── Input rendering based on type ──

function ConfigInput({
  setting,
  dirtyValue,
  onChange,
}: {
  setting: ConfigSetting;
  dirtyValue: string | undefined;
  onChange: (value: string) => void;
}) {
  if (setting.isSecret) {
    return (
      <Input
        type="password"
        value={dirtyValue ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={setting.validationHint ?? 'Enter new value...'}
        className="max-w-md"
      />
    );
  }

  if (setting.inputType === 'select' && setting.selectOptions) {
    return (
      <SelectInput
        options={setting.selectOptions}
        value={dirtyValue ?? setting.value ?? ''}
        onChange={onChange}
      />
    );
  }

  if (setting.inputType === 'number') {
    return (
      <Input
        type="number"
        value={dirtyValue ?? setting.value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={setting.validationHint ?? ''}
        className="max-w-md"
        min={1}
      />
    );
  }

  return (
    <Input
      type={setting.inputType === 'email' ? 'email' : 'text'}
      value={dirtyValue ?? setting.value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={setting.validationHint ?? ''}
      className="max-w-md"
    />
  );
}

// ── Select input using combobox ──

function SelectInput({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="max-w-md w-full justify-between"
        >
          {value || <span className="text-foreground-muted">Select...</span>}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-md w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(selected) => {
                    onChange(selected);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 size-4', value === option ? 'opacity-100' : 'opacity-0')}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Source badge ──

function SourceBadge({ source }: { source: ConfigSetting['source'] }) {
  switch (source) {
    case 'dashboard':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-info-text border-info-border gap-1 text-xs">
                <Database className="size-3" />
                Dashboard
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Value set via the super user dashboard (overrides environment)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case 'environment':
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-success-text border-success-border gap-1 text-xs"
              >
                <Server className="size-3" />
                Environment
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Value provided by environment variable</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case 'none':
    default:
      return (
        <Badge
          variant="outline"
          className="text-foreground-muted border-foreground-muted/30 gap-1 text-xs"
        >
          <Minus className="size-3" />
          Not configured
        </Badge>
      );
  }
}
