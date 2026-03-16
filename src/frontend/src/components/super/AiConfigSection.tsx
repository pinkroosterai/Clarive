import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  findSetting,
  buildProviderModels,
  findModelMetadata,
  type ProviderModel,
} from './ai-config/aiConfigUtils';
import ModelOverrideFields from './ai-config/ModelOverrideFields';
import ModelTransferList from './ai-config/ModelTransferList';
import ProviderModelCombobox from './ai-config/ProviderModelCombobox';
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

  const defaultModelSetting = findSetting(settings, 'Ai:DefaultModel');
  const defaultProviderIdSetting = findSetting(settings, 'Ai:DefaultModelProviderId');
  const premiumModelSetting = findSetting(settings, 'Ai:PremiumModel');
  const premiumProviderIdSetting = findSetting(settings, 'Ai:PremiumModelProviderId');
  const allowedModelsSetting = findSetting(settings, 'Ai:AllowedModels');
  const tavilyApiKeySetting = findSetting(settings, 'Ai:TavilyApiKey');

  const currentDefaultModel = dirtyValues['Ai:DefaultModel'] ?? defaultModelSetting?.value ?? '';
  const currentDefaultProviderId =
    dirtyValues['Ai:DefaultModelProviderId'] ?? defaultProviderIdSetting?.value ?? '';
  const currentPremiumModel = dirtyValues['Ai:PremiumModel'] ?? premiumModelSetting?.value ?? '';
  const currentPremiumProviderId =
    dirtyValues['Ai:PremiumModelProviderId'] ?? premiumProviderIdSetting?.value ?? '';
  const currentAllowedModels = dirtyValues['Ai:AllowedModels'] ?? allowedModelsSetting?.value ?? '';
  const currentTavilyKeyDirty = dirtyValues['Ai:TavilyApiKey'];

  // Fetch provider-configured models
  const { data: providers, isLoading: providersLoading } = useQuery({
    queryKey: ['super', 'ai-providers'],
    queryFn: getProviders,
    staleTime: 5 * 60 * 1000,
  });

  const providerModels = useMemo(() => buildProviderModels(providers), [providers]);
  const flatModels = useMemo(() => providerModels.map((m) => m.modelId), [providerModels]);
  const hasModels = providerModels.length > 0;

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

  // Find the provider name for a currently selected model+providerId
  const findProviderName = (modelId: string, providerId: string): string | undefined => {
    if (!providerId || !modelId) return undefined;
    return providerModels.find((m) => m.modelId === modelId && m.providerId === providerId)
      ?.providerName;
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
            <ProviderModelCombobox
              providerModels={providerModels}
              value={currentDefaultModel}
              providerId={currentDefaultProviderId}
              providerName={findProviderName(currentDefaultModel, currentDefaultProviderId)}
              onSelect={(m) => handleModelSelect('Ai:DefaultModel', 'Ai:DefaultModelProviderId', m)}
              onClear={() => handleModelClear('Ai:DefaultModel', 'Ai:DefaultModelProviderId')}
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

      {/* Default Model Parameter Overrides */}
      {currentDefaultModel && (
        <ModelOverrideFields
          prefix="DefaultModel"
          settings={settings}
          dirtyValues={dirtyValues}
          modelMetadata={findModelMetadata(
            providers,
            currentDefaultModel,
            currentDefaultProviderId
          )}
          onChange={handleChange}
          onReset={(key) => resetMutation.mutate(key)}
          isResetting={(key) => resetMutation.isPending && resetMutation.variables === key}
        />
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
            <ProviderModelCombobox
              providerModels={providerModels}
              value={currentPremiumModel}
              providerId={currentPremiumProviderId}
              providerName={findProviderName(currentPremiumModel, currentPremiumProviderId)}
              onSelect={(m) => handleModelSelect('Ai:PremiumModel', 'Ai:PremiumModelProviderId', m)}
              onClear={() => handleModelClear('Ai:PremiumModel', 'Ai:PremiumModelProviderId')}
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

      {/* Premium Model Parameter Overrides */}
      {currentPremiumModel && (
        <ModelOverrideFields
          prefix="PremiumModel"
          settings={settings}
          dirtyValues={dirtyValues}
          modelMetadata={findModelMetadata(
            providers,
            currentPremiumModel,
            currentPremiumProviderId
          )}
          onChange={handleChange}
          onReset={(key) => resetMutation.mutate(key)}
          isResetting={(key) => resetMutation.isPending && resetMutation.variables === key}
        />
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
