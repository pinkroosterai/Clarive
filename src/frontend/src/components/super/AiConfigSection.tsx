import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Check,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Minus,
  RotateCcw,
  Save,
  Search,
  Server,
  Database,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { handleApiError } from '@/lib/handleApiError';
import { cn } from '@/lib/utils';
import {
  setConfigValue,
  resetConfigValue,
  type ConfigSetting,
} from '@/services/api/configService';
import { getProviders } from '@/services/api/aiProviderService';

interface AiConfigSectionProps {
  settings: ConfigSetting[];
  onSaved: () => void;
}

function findSetting(settings: ConfigSetting[], key: string): ConfigSetting | undefined {
  return settings.find((s) => s.key === key);
}

export default function AiConfigSection({ settings, onSaved }: AiConfigSectionProps) {
  const queryClient = useQueryClient();
  const [dirtyValues, setDirtyValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const defaultModelSetting = findSetting(settings, 'Ai:DefaultModel');
  const premiumModelSetting = findSetting(settings, 'Ai:PremiumModel');
  const allowedModelsSetting = findSetting(settings, 'Ai:AllowedModels');
  const tavilyApiKeySetting = findSetting(settings, 'Ai:TavilyApiKey');

  const currentDefaultModel = dirtyValues['Ai:DefaultModel'] ?? defaultModelSetting?.value ?? '';
  const currentPremiumModel = dirtyValues['Ai:PremiumModel'] ?? premiumModelSetting?.value ?? '';
  const currentAllowedModels = dirtyValues['Ai:AllowedModels'] ?? allowedModelsSetting?.value ?? '';
  const currentTavilyKeyDirty = dirtyValues['Ai:TavilyApiKey'];

  // Fetch provider-configured models
  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: ['super', 'ai-providers'],
    queryFn: getProviders,
    staleTime: 5 * 60 * 1000,
  });

  const models = useMemo(() => {
    if (!providers) return [];
    return providers
      .filter((p) => p.isActive)
      .flatMap((p) => p.models.filter((m) => m.isActive).map((m) => m.modelId));
  }, [providers]);

  const hasModels = models.length > 0;

  const resetMutation = useMutation({
    mutationFn: (key: string) => resetConfigValue(key),
    onSuccess: (_data, key) => {
      toast.success(`Reset to default: ${findSetting(settings, key)?.label ?? key}`);
      setDirtyValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['super', 'config'] });
    },
    onError: (err) => handleApiError(err, { fallback: 'Failed to reset setting' }),
  });

  const handleChange = (key: string, newValue: string) => {
    const setting = findSetting(settings, key);
    if (!setting) return;

    if (setting.isSecret && newValue === '') {
      setDirtyValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else if (!setting.isSecret && newValue === (setting.value ?? '')) {
      setDirtyValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setDirtyValues((prev) => ({ ...prev, [key]: newValue }));
    }
  };

  const hasDirty = Object.keys(dirtyValues).length > 0;

  const handleSave = async () => {
    if (!hasDirty) return;

    setSaving(true);
    try {
      let savedCount = 0;
      for (const [key, value] of Object.entries(dirtyValues)) {
        if (value === '') {
          await resetConfigValue(key);
        } else {
          await setConfigValue(key, value);
        }
        savedCount++;
      }

      setDirtyValues({});
      queryClient.invalidateQueries({ queryKey: ['super', 'config'] });
      toast.success(`${savedCount} setting${savedCount > 1 ? 's' : ''} saved`);
      onSaved();
    } catch (err) {
      handleApiError(err, { fallback: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      {/* Default Model */}
      {defaultModelSetting && (
        <SettingField
          setting={defaultModelSetting}
          onReset={() => resetMutation.mutate(defaultModelSetting.key)}
          isResetting={
            resetMutation.isPending && resetMutation.variables === defaultModelSetting.key
          }
        >
          {hasModels ? (
            <ModelCombobox
              models={models}
              value={currentDefaultModel}
              onChange={(value) => handleChange('Ai:DefaultModel', value)}
              loading={providersLoading}
              placeholder="Select default model..."
            />
          ) : (
            <div className="space-y-1">
              <Input
                type="text"
                value={currentDefaultModel}
                onChange={(e) => handleChange('Ai:DefaultModel', e.target.value)}
                placeholder={defaultModelSetting.validationHint ?? ''}
                className="max-w-md"
              />
              {!providersLoading && (
                <p className="text-xs text-foreground-muted">
                  Add an AI provider with models to enable the model selector.
                </p>
              )}
            </div>
          )}
        </SettingField>
      )}

      <Separator className="my-4" />

      {/* Premium Model */}
      {premiumModelSetting && (
        <SettingField
          setting={premiumModelSetting}
          onReset={() => resetMutation.mutate(premiumModelSetting.key)}
          isResetting={
            resetMutation.isPending && resetMutation.variables === premiumModelSetting.key
          }
        >
          {hasModels ? (
            <ModelCombobox
              models={models}
              value={currentPremiumModel}
              onChange={(value) => handleChange('Ai:PremiumModel', value)}
              loading={providersLoading}
              placeholder="Select premium model..."
            />
          ) : (
            <div className="space-y-1">
              <Input
                type="text"
                value={currentPremiumModel}
                onChange={(e) => handleChange('Ai:PremiumModel', e.target.value)}
                placeholder={premiumModelSetting.validationHint ?? ''}
                className="max-w-md"
              />
              {!providersLoading && (
                <p className="text-xs text-foreground-muted">
                  Add an AI provider with models to enable the model selector.
                </p>
              )}
            </div>
          )}
        </SettingField>
      )}

      {/* Allowed Playground Models */}
      {allowedModelsSetting && (
        <>
          <Separator className="my-4" />
          <SettingField
            setting={allowedModelsSetting}
            onReset={() => resetMutation.mutate(allowedModelsSetting.key)}
            isResetting={
              resetMutation.isPending && resetMutation.variables === allowedModelsSetting.key
            }
          >
            <ModelTransferList
              allModels={models}
              value={currentAllowedModels}
              onChange={(value) => handleChange('Ai:AllowedModels', value)}
              loading={providersLoading}
            />
          </SettingField>
        </>
      )}

      {/* Tavily API Key */}
      {tavilyApiKeySetting && (
        <>
          <Separator className="my-4" />
          <SettingField
            setting={tavilyApiKeySetting}
            onReset={() => resetMutation.mutate(tavilyApiKeySetting.key)}
            isResetting={
              resetMutation.isPending && resetMutation.variables === tavilyApiKeySetting.key
            }
          >
            <Input
              type="password"
              value={currentTavilyKeyDirty ?? ''}
              onChange={(e) => handleChange('Ai:TavilyApiKey', e.target.value)}
              placeholder={tavilyApiKeySetting.validationHint ?? 'Enter Tavily API key...'}
              className="max-w-md"
            />
          </SettingField>
        </>
      )}

      {/* Save */}
      <div className="pt-4">
        <Button onClick={handleSave} disabled={!hasDirty || saving} size="sm">
          <Save className="size-4 mr-1.5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

// ── Shared field wrapper ──

interface SettingFieldProps {
  setting: ConfigSetting;
  onReset: () => void;
  isResetting: boolean;
  children: React.ReactNode;
}

function SettingField({ setting, onReset, isResetting, children }: SettingFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{setting.label}</Label>
        <SourceBadge source={setting.source} />
      </div>
      <p className="text-xs text-foreground-muted">{setting.description}</p>
      <div className="flex items-center gap-2">
        {children}
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
    </div>
  );
}

// ── Model combobox ──

interface ModelComboboxProps {
  models: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  placeholder?: string;
}

function ModelCombobox({ models, value, onChange, loading, placeholder }: ModelComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5 max-w-md w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {loading ? (
              <span className="flex items-center gap-2 text-foreground-muted">
                <Loader2 className="size-4 animate-spin" />
                Loading models...
              </span>
            ) : value ? (
              value
            ) : (
              <span className="text-foreground-muted">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-w-md w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search models..." />
            <CommandList>
              <CommandEmpty>No models found.</CommandEmpty>
              <CommandGroup>
                {models.map((model) => (
                  <CommandItem
                    key={model}
                    value={model}
                    onSelect={(selected) => {
                      onChange(selected);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn('mr-2 size-4', value === model ? 'opacity-100' : 'opacity-0')}
                    />
                    {model}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange('')}
                className="shrink-0"
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear selection</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ── Model transfer list ──

interface ModelTransferListProps {
  allModels: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

function ModelTransferList({ allModels, value, onChange, loading }: ModelTransferListProps) {
  const [search, setSearch] = useState('');

  const allowedSet = useMemo(() => {
    if (!value) return new Set<string>();
    return new Set(
      value.split(',').map((s) => s.trim()).filter(Boolean)
    );
  }, [value]);

  const available = useMemo(() => {
    const filtered = allModels.filter((m) => !allowedSet.has(m));
    if (!search) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((m) => m.toLowerCase().includes(q));
  }, [allModels, allowedSet, search]);

  const allowed = useMemo(() => {
    return value
      ? value.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  }, [value]);

  const addModel = (model: string) => {
    const next = [...allowed, model];
    onChange(next.join(','));
  };

  const removeModel = (model: string) => {
    const next = allowed.filter((m) => m !== model);
    onChange(next.join(','));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground-muted py-4">
        <Loader2 className="size-4 animate-spin" />
        Loading models...
      </div>
    );
  }

  if (allModels.length === 0) {
    return (
      <p className="text-sm text-foreground-muted py-2">
        Add an AI provider with models to configure allowed playground models.
      </p>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Available models (left) */}
      <div className="flex-1 space-y-2">
        <Label className="text-xs text-foreground-muted">Available Models</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-foreground-muted" />
          <Input
            placeholder="Filter models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <ScrollArea className="h-48 border border-border-subtle rounded-md">
          <div className="p-1">
            {available.length === 0 ? (
              <p className="text-xs text-foreground-muted p-2 text-center">
                {search ? 'No matching models' : 'All models selected'}
              </p>
            ) : (
              available.map((model) => (
                <button
                  key={model}
                  onClick={() => addModel(model)}
                  className="flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-elevated transition-colors group"
                >
                  <span className="font-mono truncate">{model}</span>
                  <ChevronRight className="size-3 opacity-0 group-hover:opacity-100 text-foreground-muted shrink-0" />
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Allowed models (right) */}
      <div className="flex-1 space-y-2">
        <Label className="text-xs text-foreground-muted">
          Allowed Models ({allowed.length})
        </Label>
        <ScrollArea className="h-[calc(2rem+12rem+2px)] border border-border-subtle rounded-md">
          <div className="p-1">
            {allowed.length === 0 ? (
              <p className="text-xs text-foreground-muted p-2 text-center">
                All models allowed
              </p>
            ) : (
              allowed.map((model) => (
                <div
                  key={model}
                  className="flex items-center justify-between px-2 py-1 text-xs rounded hover:bg-elevated transition-colors group"
                >
                  <span className="font-mono truncate">{model}</span>
                  <button
                    onClick={() => removeModel(model)}
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
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
