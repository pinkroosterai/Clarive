import { AlertTriangle, ChevronDown, ChevronRight, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { findModelMetadata, findSetting, type ProviderModel } from './aiConfigUtils';
import ModelOverrideFields from './ModelOverrideFields';
import ProviderModelCombobox from './ProviderModelCombobox';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { AiProviderResponse } from '@/services/api/aiProviderService';
import type { ConfigSetting } from '@/services/api/configService';

// Must match OpenAIAgentFactory.ConfigurableActions on the backend.
// A backend test (OpenAIAgentFactoryTests.ConfigurableActions_MatchesExpectedActionList)
// will fail if the backend list changes, signalling this array needs updating too.
const CONFIGURABLE_ACTIONS = [
  { key: 'Generation', label: 'Generation', description: 'Main AI wizard prompt generation' },
  { key: 'Evaluation', label: 'Evaluation', description: 'Quality scoring after generation' },
  { key: 'Clarification', label: 'Clarification', description: 'Follow-up questions after generation' },
  { key: 'SystemMessage', label: 'System Message', description: 'Generate system message for entries' },
  { key: 'Decomposition', label: 'Decomposition', description: 'Split prompts into chain steps' },
  {
    key: 'FillTemplateFields',
    label: 'Fill Template Fields',
    description: 'Generate template field examples',
  },
  {
    key: 'PlaygroundJudge',
    label: 'Playground Judge',
    description: 'Score playground run outputs',
  },
  {
    key: 'PolishDescription',
    label: 'Polish Description',
    description: 'Rewrite rough wizard descriptions into clear input',
  },
] as const;

interface ActionModelTableProps {
  settings: ConfigSetting[];
  dirtyValues: Record<string, string>;
  agentCapableModels: ProviderModel[];
  providerModels: ProviderModel[];
  providers: AiProviderResponse[] | undefined;
  providersLoading: boolean;
  onChange: (key: string, value: string) => void;
  onModelSelect: (modelKey: string, providerIdKey: string, model: ProviderModel) => void;
  onModelClear: (modelKey: string, providerIdKey: string) => void;
  onReset: (key: string) => void;
  isResetting: (key: string) => boolean;
}

export default function ActionModelTable({
  settings,
  dirtyValues,
  agentCapableModels,
  providerModels,
  providers,
  providersLoading,
  onChange,
  onModelSelect,
  onModelClear,
  onReset,
  isResetting,
}: ActionModelTableProps) {
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);

  const hasModels = providerModels.length > 0;

  const findProviderName = (modelId: string, providerId: string): string | undefined => {
    if (!providerId || !modelId) return undefined;
    return providerModels.find((m) => m.modelId === modelId && m.providerId === providerId)
      ?.providerName;
  };

  const unsetCount = useMemo(() => {
    return CONFIGURABLE_ACTIONS.filter((action) => {
      const modelKey = `Ai:${action.key}:Model`;
      const value = dirtyValues[modelKey] ?? findSetting(settings, modelKey)?.value ?? '';
      return !value;
    }).length;
  }, [settings, dirtyValues]);

  const handleQuickSetup = (model: ProviderModel) => {
    for (const action of CONFIGURABLE_ACTIONS) {
      onModelSelect(`Ai:${action.key}:Model`, `Ai:${action.key}:ProviderId`, model);
    }
    setQuickSetupOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* Warning banner */}
      {unsetCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            AI features are disabled — {unsetCount} action{unsetCount > 1 ? 's' : ''} need
            {unsetCount === 1 ? 's' : ''} a model assignment.
          </span>
        </div>
      )}

      {/* Capability hint */}
      {hasModels && agentCapableModels.length < providerModels.length && (
        <p className="text-xs text-foreground-muted">
          Only models with function calling and structured response support are shown.
          Add models with these capabilities in Providers &amp; Models to see more options.
        </p>
      )}

      {/* Quick Setup */}
      {hasModels && (
        <div className="flex items-center gap-2">
          {quickSetupOpen ? (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <ProviderModelCombobox
                providerModels={agentCapableModels}
                value=""
                providerId=""
                onSelect={handleQuickSetup}
                onClear={() => setQuickSetupOpen(false)}
                loading={providersLoading}
                placeholder="Select model for all actions..."
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuickSetupOpen(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickSetupOpen(true)}
              className="gap-1.5"
            >
              <Wand2 className="size-3.5" />
              Quick Setup
            </Button>
          )}
        </div>
      )}

      {/* Action rows */}
      <div className="rounded-md border border-border-subtle divide-y divide-border-subtle">
        {CONFIGURABLE_ACTIONS.map((action) => {
          const modelKey = `Ai:${action.key}:Model`;
          const providerIdKey = `Ai:${action.key}:ProviderId`;
          const currentModel = dirtyValues[modelKey] ?? findSetting(settings, modelKey)?.value ?? '';
          const currentProviderId =
            dirtyValues[providerIdKey] ?? findSetting(settings, providerIdKey)?.value ?? '';
          const isExpanded = expandedAction === action.key;
          const hasModel = !!currentModel;

          return (
            <div key={action.key} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                {/* Action label */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-36 shrink-0">
                      <span
                        className={`text-sm font-medium ${!hasModel ? 'text-destructive' : ''}`}
                      >
                        {action.label}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{action.description}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Model selector */}
                <div className="flex-1 min-w-0">
                  {hasModels ? (
                    <ProviderModelCombobox
                      providerModels={agentCapableModels}
                      value={currentModel}
                      providerId={currentProviderId}
                      providerName={findProviderName(currentModel, currentProviderId)}
                      onSelect={(m) => onModelSelect(modelKey, providerIdKey, m)}
                      onClear={() => onModelClear(modelKey, providerIdKey)}
                      loading={providersLoading}
                      placeholder="Select model..."
                    />
                  ) : (
                    <span className="text-sm text-foreground-muted">
                      Add an AI provider to configure
                    </span>
                  )}
                </div>

                {/* Expand overrides */}
                {hasModel && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => setExpandedAction(isExpanded ? null : action.key)}
                    aria-label={isExpanded ? 'Collapse overrides' : 'Expand overrides'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>

              {/* Parameter overrides */}
              {isExpanded && hasModel && (
                <ModelOverrideFields
                  prefix={action.key}
                  settings={settings}
                  dirtyValues={dirtyValues}
                  modelMetadata={findModelMetadata(providers, currentModel, currentProviderId)}
                  onChange={onChange}
                  onReset={onReset}
                  isResetting={isResetting}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
