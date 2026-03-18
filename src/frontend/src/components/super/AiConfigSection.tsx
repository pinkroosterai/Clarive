import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  findSetting,
  buildProviderModels,
  type ProviderModel,
} from './ai-config/aiConfigUtils';
import ActionModelTable from './ai-config/ActionModelTable';
import ModelTransferList from './ai-config/ModelTransferList';
import SettingField from './ai-config/SettingField';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { handleApiError } from '@/lib/handleApiError';
import { getProviders } from '@/services/api/aiProviderService';
import { setConfigValue, resetConfigValue, type ConfigSetting } from '@/services/api/configService';

interface AiConfigSectionProps {
  settings: ConfigSetting[];
  onSaved: () => void;
}

export default function AiConfigSection({ settings, onSaved }: AiConfigSectionProps) {
  const queryClient = useQueryClient();
  const [dirtyValues, setDirtyValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const allowedModelsSetting = findSetting(settings, 'Ai:AllowedModels');
  const tavilyApiKeySetting = findSetting(settings, 'Ai:TavilyApiKey');

  const currentAllowedModels = dirtyValues['Ai:AllowedModels'] ?? allowedModelsSetting?.value ?? '';
  const currentTavilyKeyDirty = dirtyValues['Ai:TavilyApiKey'];

  // Fetch provider-configured models
  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: ['super', 'ai-providers'],
    queryFn: getProviders,
    staleTime: 5 * 60 * 1000,
  });

  const providerModels = useMemo(() => buildProviderModels(providers), [providers]);
  const agentCapableModels = useMemo(
    () => providerModels.filter((m) => m.supportsFunctionCalling && m.supportsResponseSchema),
    [providerModels]
  );
  const flatModels = useMemo(() => providerModels.map((m) => m.modelId), [providerModels]);

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

  const handleModelSelect = (modelKey: string, providerIdKey: string, model: ProviderModel) => {
    setDirtyValues((prev) => ({
      ...prev,
      [modelKey]: model.modelId,
      [providerIdKey]: model.providerId,
    }));
  };

  const handleModelClear = (modelKey: string, providerIdKey: string) => {
    setDirtyValues((prev) => ({
      ...prev,
      [modelKey]: '',
      [providerIdKey]: '',
    }));
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
      {/* Per-Action Model Configuration */}
      <ActionModelTable
        settings={settings}
        dirtyValues={dirtyValues}
        agentCapableModels={agentCapableModels}
        providerModels={providerModels}
        providers={providers}
        providersLoading={providersLoading}
        onChange={handleChange}
        onModelSelect={handleModelSelect}
        onModelClear={handleModelClear}
        onReset={(key) => resetMutation.mutate(key)}
        isResetting={(key) => resetMutation.isPending && resetMutation.variables === key}
      />

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
              allModels={flatModels}
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
              autoComplete="new-password"
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
