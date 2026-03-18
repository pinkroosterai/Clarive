import { findSetting } from './aiConfigUtils';
import SettingField from './SettingField';

import { Input } from '@/components/ui/input';
import type { AiProviderModelResponse } from '@/services/api/aiProviderService';
import type { ConfigSetting } from '@/services/api/configService';

interface ModelOverrideFieldsProps {
  prefix: string;
  settings: ConfigSetting[];
  dirtyValues: Record<string, string>;
  modelMetadata: AiProviderModelResponse | null;
  onChange: (key: string, value: string) => void;
  onReset: (key: string) => void;
  isResetting: (key: string) => boolean;
}

export default function ModelOverrideFields({
  prefix,
  settings,
  dirtyValues,
  modelMetadata,
  onChange,
  onReset,
  isResetting,
}: ModelOverrideFieldsProps) {
  const tempKey = `Ai:${prefix}:Temperature`;
  const tokensKey = `Ai:${prefix}:MaxTokens`;
  const effortKey = `Ai:${prefix}:ReasoningEffort`;

  const tempSetting = findSetting(settings, tempKey);
  const tokensSetting = findSetting(settings, tokensKey);
  const effortSetting = findSetting(settings, effortKey);

  const currentTemp = dirtyValues[tempKey] ?? tempSetting?.value ?? '';
  const currentTokens = dirtyValues[tokensKey] ?? tokensSetting?.value ?? '';
  const currentEffort = dirtyValues[effortKey] ?? effortSetting?.value ?? '';

  const modelTempDefault = modelMetadata?.defaultTemperature;
  const modelTokensDefault = modelMetadata?.defaultMaxTokens;
  const modelEffortDefault = modelMetadata?.defaultReasoningEffort;
  const isReasoning = modelMetadata?.isReasoning ?? false;

  return (
    <div className="ml-4 mt-3 space-y-3 border-l-2 border-border-subtle pl-4">
      <p className="text-xs font-medium text-foreground-muted">Parameter Overrides</p>

      {/* Temperature — only for non-reasoning models */}
      {!isReasoning && tempSetting && (
        <SettingField
          setting={tempSetting}
          onReset={() => onReset(tempKey)}
          isResetting={isResetting(tempKey)}
        >
          <Input
            type="number"
            value={currentTemp}
            onChange={(e) => onChange(tempKey, e.target.value)}
            placeholder={
              modelTempDefault != null ? `Model default: ${modelTempDefault}` : 'Not set'
            }
            className="max-w-[200px]"
            min={0}
            max={2}
            step={0.1}
          />
        </SettingField>
      )}

      {/* Max Tokens */}
      {tokensSetting && (
        <SettingField
          setting={tokensSetting}
          onReset={() => onReset(tokensKey)}
          isResetting={isResetting(tokensKey)}
        >
          <Input
            type="number"
            value={currentTokens}
            onChange={(e) => onChange(tokensKey, e.target.value)}
            placeholder={
              modelTokensDefault != null ? `Model default: ${modelTokensDefault}` : 'Not set'
            }
            className="max-w-[200px]"
            min={1}
          />
        </SettingField>
      )}

      {/* Reasoning Effort — only for reasoning models */}
      {isReasoning && effortSetting && (
        <SettingField
          setting={effortSetting}
          onReset={() => onReset(effortKey)}
          isResetting={isResetting(effortKey)}
        >
          <select
            value={currentEffort}
            onChange={(e) => onChange(effortKey, e.target.value)}
            className="h-9 rounded-md border border-border-subtle bg-background px-3 text-sm max-w-[200px]"
          >
            <option value="">
              {modelEffortDefault ? `Model default: ${modelEffortDefault}` : 'Not set'}
            </option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="extra-high">Extra High</option>
          </select>
        </SettingField>
      )}
    </div>
  );
}
