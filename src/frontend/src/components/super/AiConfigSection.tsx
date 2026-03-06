import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Minus,
  RotateCcw,
  Save,
  Server,
  Database,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import {
  setConfigValue,
  resetConfigValue,
  validateAiConfig,
  getAiModels,
  type ConfigSetting,
} from '@/services/api/configService';

interface AiConfigSectionProps {
  settings: ConfigSetting[];
  onSaved: () => void;
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

function findSetting(settings: ConfigSetting[], key: string): ConfigSetting | undefined {
  return settings.find((s) => s.key === key);
}

export default function AiConfigSection({ settings, onSaved }: AiConfigSectionProps) {
  const queryClient = useQueryClient();
  const [dirtyValues, setDirtyValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  const endpointSetting = findSetting(settings, 'Ai:EndpointUrl');
  const apiKeySetting = findSetting(settings, 'Ai:OpenAiApiKey');
  const defaultModelSetting = findSetting(settings, 'Ai:DefaultModel');
  const premiumModelSetting = findSetting(settings, 'Ai:PremiumModel');

  const currentEndpoint = dirtyValues['Ai:EndpointUrl'] ?? endpointSetting?.value ?? '';
  const currentApiKeyDirty = dirtyValues['Ai:OpenAiApiKey'];
  const currentDefaultModel = dirtyValues['Ai:DefaultModel'] ?? defaultModelSetting?.value ?? '';
  const currentPremiumModel = dirtyValues['Ai:PremiumModel'] ?? premiumModelSetting?.value ?? '';

  const apiKeyIsConfigured = apiKeySetting?.isConfigured ?? false;

  // Fetch models when API key is configured
  const {
    data: modelsData,
    isLoading: modelsLoading,
    isError: modelsFetchFailed,
  } = useQuery({
    queryKey: ['super', 'ai-models'],
    queryFn: () => getAiModels({}),
    enabled: apiKeyIsConfigured && validationState !== 'valid',
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Re-fetch models after successful validation with the new key/endpoint
  const { data: validatedModelsData, isLoading: validatedModelsLoading } = useQuery({
    queryKey: ['super', 'ai-models', 'validated', currentApiKeyDirty, currentEndpoint],
    queryFn: () =>
      getAiModels({
        apiKey: currentApiKeyDirty || undefined,
        endpointUrl: currentEndpoint || undefined,
      }),
    enabled: validationState === 'valid',
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const models =
    (validationState === 'valid' ? validatedModelsData?.models : modelsData?.models) ?? [];
  const isLoadingModels = modelsLoading || validatedModelsLoading;
  const hasModels = models.length > 0;
  const useCombobox = hasModels && !modelsFetchFailed;

  // Reset validation when key or endpoint changes
  useEffect(() => {
    if (currentApiKeyDirty !== undefined || dirtyValues['Ai:EndpointUrl'] !== undefined) {
      setValidationState('idle');
      setValidationError(null);
    }
  }, [currentApiKeyDirty, dirtyValues]);

  const validateMutation = useMutation({
    mutationFn: () => {
      const apiKey = currentApiKeyDirty || '';
      if (!apiKey && !apiKeyIsConfigured) {
        return Promise.resolve({ valid: false, error: 'Enter an API key first' } as const);
      }
      return validateAiConfig({
        apiKey,
        endpointUrl: currentEndpoint || undefined,
      });
    },
    onMutate: () => {
      setValidationState('validating');
      setValidationError(null);
    },
    onSuccess: (result) => {
      if (result.valid) {
        setValidationState('valid');
        toast.success('API key is valid');
      } else {
        setValidationState('invalid');
        setValidationError(result.error ?? 'Validation failed');
        toast.error(result.error ?? 'Validation failed');
      }
    },
    onError: (err) => {
      setValidationState('invalid');
      setValidationError('Validation request failed');
      handleApiError(err, { fallback: 'Failed to validate API key' });
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ['super', 'ai-models'] });
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
  const apiKeyIsDirty = currentApiKeyDirty !== undefined;
  const needsValidation = apiKeyIsDirty && validationState !== 'valid';

  const handleSave = async () => {
    if (!hasDirty) return;
    if (needsValidation) {
      toast.error('Please validate the API key before saving');
      return;
    }

    setSaving(true);
    try {
      let savedCount = 0;
      for (const [key, value] of Object.entries(dirtyValues)) {
        await setConfigValue(key, value);
        savedCount++;
      }

      setDirtyValues({});
      setValidationState('idle');
      queryClient.invalidateQueries({ queryKey: ['super', 'config'] });
      queryClient.invalidateQueries({ queryKey: ['super', 'ai-models'] });
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
      {/* Endpoint URL */}
      {endpointSetting && (
        <SettingField
          setting={endpointSetting}
          onReset={() => resetMutation.mutate(endpointSetting.key)}
          isResetting={resetMutation.isPending && resetMutation.variables === endpointSetting.key}
        >
          <Input
            type="text"
            value={currentEndpoint}
            onChange={(e) => handleChange('Ai:EndpointUrl', e.target.value)}
            placeholder={endpointSetting.validationHint ?? ''}
            className="max-w-md"
          />
        </SettingField>
      )}

      <Separator className="my-4" />

      {/* API Key */}
      {apiKeySetting && (
        <SettingField
          setting={apiKeySetting}
          onReset={() => resetMutation.mutate(apiKeySetting.key)}
          isResetting={resetMutation.isPending && resetMutation.variables === apiKeySetting.key}
        >
          <div className="flex items-center gap-2 max-w-md w-full">
            <Input
              type="password"
              value={currentApiKeyDirty ?? ''}
              onChange={(e) => handleChange('Ai:OpenAiApiKey', e.target.value)}
              placeholder={apiKeySetting.validationHint ?? 'Enter API key...'}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => validateMutation.mutate()}
              disabled={validationState === 'validating' || (!apiKeyIsDirty && !apiKeyIsConfigured)}
            >
              {validationState === 'validating' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : validationState === 'valid' ? (
                <ShieldCheck className="size-4 text-success-text" />
              ) : validationState === 'invalid' ? (
                <ShieldX className="size-4 text-destructive" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              <span className="ml-1">Validate</span>
            </Button>
          </div>
          {validationState === 'invalid' && validationError && (
            <p className="text-xs text-destructive mt-1">{validationError}</p>
          )}
        </SettingField>
      )}

      <Separator className="my-4" />

      {/* Default Model */}
      {defaultModelSetting && (
        <SettingField
          setting={defaultModelSetting}
          onReset={() => resetMutation.mutate(defaultModelSetting.key)}
          isResetting={
            resetMutation.isPending && resetMutation.variables === defaultModelSetting.key
          }
        >
          {useCombobox ? (
            <ModelCombobox
              models={models}
              value={currentDefaultModel}
              onChange={(value) => handleChange('Ai:DefaultModel', value)}
              loading={isLoadingModels}
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
              {modelsFetchFailed && apiKeyIsConfigured && (
                <p className="text-xs text-warning-text flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Could not fetch models — using free text input
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
          {useCombobox ? (
            <ModelCombobox
              models={models}
              value={currentPremiumModel}
              onChange={(value) => handleChange('Ai:PremiumModel', value)}
              loading={isLoadingModels}
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
              {modelsFetchFailed && apiKeyIsConfigured && (
                <p className="text-xs text-warning-text flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Could not fetch models — using free text input
                </p>
              )}
            </div>
          )}
        </SettingField>
      )}

      {/* Save */}
      <div className="pt-4">
        <Button onClick={handleSave} disabled={!hasDirty || saving || needsValidation} size="sm">
          <Save className="size-4 mr-1.5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        {needsValidation && hasDirty && (
          <p className="text-xs text-foreground-muted mt-2">Validate the API key before saving</p>
        )}
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="max-w-md w-full justify-between"
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
