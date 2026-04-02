import { Braces, Brain, Lock, LockOpen, Plus, SquareFunction, Trash2, X } from 'lucide-react';

import React, { useCallback, useMemo, useState } from 'react';

import ModelBrowser from './ModelBrowser';
import { useDebouncedUpdate } from './useDebouncedUpdate';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type {
  AiProviderResponse,
  AiProviderModelResponse,
  FetchedModelItem,
} from '@/services/api/aiProviderService';

interface ProviderCardExpandedProps {
  provider: AiProviderResponse;
  onFetchModels: () => Promise<FetchedModelItem[]>;
  onAddModel: (modelId: string, isReasoning?: boolean) => void;
  onUpdateModel: (modelId: string, data: Record<string, unknown>) => void;
  onDeleteModel: (modelId: string) => void;
  onUpdateProvider: (data: Record<string, unknown>) => void;
  isFetchingModels: boolean;
  fetchedModels: FetchedModelItem[] | null;
}

export default function ProviderCardExpanded({
  provider,
  onFetchModels,
  onAddModel,
  onUpdateModel,
  onDeleteModel,
  onUpdateProvider,
  isFetchingModels,
  fetchedModels,
}: ProviderCardExpandedProps) {
  const availableModels = useMemo(() => {
    if (!fetchedModels) return [];
    return fetchedModels.filter(
      (m) => !provider.models.some((pm) => pm.modelId === m.modelId)
    );
  }, [fetchedModels, provider.models]);

  const handleAddModel = useCallback(
    (modelId: string) => {
      const model = availableModels.find((m) => m.modelId === modelId);
      onAddModel(modelId, model?.isReasoning);
    },
    [availableModels, onAddModel]
  );

  return (
    <div className="border-t border-border-subtle px-4 py-3 space-y-4">
      {/* Add Model — smart browser + fetch button */}
      <div className="space-y-2">
        <Label className="text-xs text-foreground-muted">Add Model</Label>
        <ModelBrowser
          models={availableModels}
          onAddModel={handleAddModel}
          isFetchingModels={isFetchingModels}
          onFetchModels={onFetchModels}
          fetchedModels={fetchedModels}
        />
      </div>

      {/* Configured models table */}
      {/* API Mode */}
      <div className="flex items-center gap-3">
        <Label className="text-xs text-foreground-muted whitespace-nowrap">API Mode</Label>
        <Select
          value={provider.apiMode}
          onValueChange={(value) => onUpdateProvider({ apiMode: value })}
        >
          <SelectTrigger className="h-7 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ResponsesApi">Responses API</SelectItem>
            <SelectItem value="ChatCompletions">Chat Completions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Use Provider Pricing */}
      <div className="flex items-center gap-3">
        <Label className="text-xs text-foreground-muted whitespace-nowrap">
          Use provider pricing
        </Label>
        <Switch
          checked={provider.useProviderPricing}
          onCheckedChange={(checked) => onUpdateProvider({ useProviderPricing: checked })}
          className="scale-90"
        />
        <span className="text-[10px] text-foreground-muted">
          When enabled, model costs are fetched from this provider instead of the global registry.
        </span>
      </div>

      {/* Custom Headers */}
      <CustomHeadersEditor
        headers={provider.customHeaders}
        onUpdate={(headers) => onUpdateProvider({ customHeaders: headers })}
      />

      {provider.models.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-foreground-muted">
            Configured Models ({provider.models.length})
          </Label>
          <div className="border border-border-subtle rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-elevated">
                <tr className="border-b border-border-subtle">
                  <th className="text-left p-2 font-medium">Model ID</th>
                  <th className="text-left p-2 font-medium">Display Name</th>
                  <th className="text-center p-2 font-medium" title="Reasoning model">
                    <Brain className="size-3.5 mx-auto" />
                  </th>
                  <th className="text-center p-2 font-medium" title="Supports function calling">
                    <SquareFunction className="size-3.5 mx-auto" />
                  </th>
                  <th className="text-center p-2 font-medium" title="Supports response schema">
                    <Braces className="size-3.5 mx-auto" />
                  </th>
                  <th className="text-center p-2 font-medium" title="Max input tokens">
                    Max In
                  </th>
                  <th className="text-center p-2 font-medium" title="Max output tokens">
                    Max Out
                  </th>
                  <th
                    className="text-center p-2 font-medium"
                    title="Default temperature for this model (0-2)"
                  >
                    Default Temp
                  </th>
                  <th
                    className="text-center p-2 font-medium"
                    title="Default max output tokens for this model"
                  >
                    Default Max Tokens
                  </th>
                  <th
                    className="text-center p-2 font-medium"
                    title="Default reasoning effort for reasoning models"
                  >
                    Default Effort
                  </th>
                  <th
                    className="text-center p-2 font-medium"
                    title="Cost per million input tokens (USD)"
                  >
                    Input $/1M
                  </th>
                  <th
                    className="text-center p-2 font-medium"
                    title="Cost per million output tokens (USD)"
                  >
                    Output $/1M
                  </th>
                  <th
                    className="text-center p-2 font-medium w-10"
                    title="Lock pricing to prevent auto-sync updates"
                  >
                    <Lock className="size-3.5 mx-auto" />
                  </th>
                  <th className="text-center p-2 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {provider.models.map((model) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    providerId={provider.id}
                    onUpdate={onUpdateModel}
                    onDelete={onDeleteModel}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {provider.models.length === 0 && !fetchedModels && (
        <p className="text-xs text-foreground-muted text-center py-4">
          Validate the provider, then fetch models to get started.
        </p>
      )}
    </div>
  );
}

// ── Custom Headers Editor ──

function CustomHeadersEditor({
  headers,
  onUpdate,
}: {
  headers: Record<string, string> | null;
  onUpdate: (headers: Record<string, string>) => void;
}) {
  const entries = useMemo(() => Object.entries(headers ?? {}), [headers]);
  const [expanded, setExpanded] = useState(entries.length > 0);

  const handleAdd = useCallback(() => {
    const updated = { ...(headers ?? {}), '': '' };
    onUpdate(updated);
    setExpanded(true);
  }, [headers, onUpdate]);

  const handleRemove = useCallback(
    (key: string) => {
      const updated = { ...(headers ?? {}) };
      delete updated[key];
      onUpdate(updated);
    },
    [headers, onUpdate]
  );

  const handleKeyChange = useCallback(
    (oldKey: string, newKey: string) => {
      const updated: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers ?? {})) {
        updated[k === oldKey ? newKey : k] = v;
      }
      onUpdate(updated);
    },
    [headers, onUpdate]
  );

  const handleValueChange = useCallback(
    (key: string, newValue: string) => {
      onUpdate({ ...(headers ?? {}), [key]: newValue });
    },
    [headers, onUpdate]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-foreground-muted hover:text-foreground flex items-center gap-1"
        >
          Custom Headers
          {entries.length > 0 && (
            <span className="text-[10px] bg-elevated px-1.5 py-0.5 rounded">
              {entries.length}
            </span>
          )}
        </button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleAdd}>
          <Plus className="size-3 mr-1" /> Add
        </Button>
      </div>
      {expanded && entries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-foreground-muted">
            HTTP headers sent with every API request to this provider.
          </p>
          {entries.map(([key, value], index) => (
            <div key={`header-${key || index}`} className="flex items-center gap-1.5">
              <Input
                value={key}
                onChange={(e) => handleKeyChange(key, e.target.value)}
                className="h-6 text-xs flex-1 font-mono"
                placeholder="Header name"
              />
              <Input
                value={value}
                onChange={(e) => handleValueChange(key, e.target.value)}
                className="h-6 text-xs flex-1"
                placeholder="Value"
              />
              <button
                onClick={() => handleRemove(key)}
                className="text-destructive hover:text-destructive/80 shrink-0"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Model Row ──

const ModelRow = React.memo(function ModelRow({
  model,
  providerId,
  onUpdate,
  onDelete,
}: {
  model: AiProviderModelResponse;
  providerId: string;
  onUpdate: (modelId: string, data: Record<string, unknown>) => void;
  onDelete: (modelId: string) => void;
}) {
  const displayName = useDebouncedUpdate(
    model.id,
    'displayName',
    model.displayName,
    onUpdate,
    (v) => v || null
  );
  const maxInputTokens = useDebouncedUpdate(
    model.id,
    'maxInputTokens',
    model.maxInputTokens,
    onUpdate,
    (v) => (v ? Number(v) : null)
  );
  const maxOutputTokens = useDebouncedUpdate(
    model.id,
    'maxOutputTokens',
    model.maxOutputTokens,
    onUpdate,
    (v) => (v ? Number(v) : null)
  );
  const temperature = useDebouncedUpdate(
    model.id,
    'defaultTemperature',
    model.defaultTemperature,
    onUpdate,
    (v) => (v ? Number(v) : null)
  );
  const maxTokens = useDebouncedUpdate(
    model.id,
    'defaultMaxTokens',
    model.defaultMaxTokens,
    onUpdate,
    (v) => (v ? Number(v) : null)
  );
  const inputCost = useDebouncedUpdate(
    model.id,
    'inputCostPerMillion',
    model.inputCostPerMillion,
    onUpdate,
    (v) => (v ? Number(v) : null)
  );
  const outputCost = useDebouncedUpdate(
    model.id,
    'outputCostPerMillion',
    model.outputCostPerMillion,
    onUpdate,
    (v) => (v ? Number(v) : null)
  );

  // Suppress unused variable warning — providerId is part of the component contract for future use
  void providerId;

  return (
    <tr className="hover:bg-elevated/50">
      <td className="p-2 font-mono">{model.modelId}</td>
      <td className="p-2">
        <Input
          value={displayName.localValue}
          onChange={(e) => displayName.handleChange(e.target.value)}
          className="h-6 text-xs w-32"
          placeholder="Optional"
        />
      </td>
      <td className="p-2 text-center">
        <Switch
          checked={model.isReasoning}
          onCheckedChange={(checked) => onUpdate(model.id, { isReasoning: checked })}
          className="scale-75"
        />
      </td>
      <td className="p-2 text-center">
        <Switch
          checked={model.supportsFunctionCalling}
          onCheckedChange={(checked) => onUpdate(model.id, { supportsFunctionCalling: checked })}
          className="scale-75"
        />
      </td>
      <td className="p-2 text-center">
        <Switch
          checked={model.supportsResponseSchema}
          onCheckedChange={(checked) => onUpdate(model.id, { supportsResponseSchema: checked })}
          className="scale-75"
        />
      </td>
      <td className="p-2 text-center">
        <Input
          type="number"
          value={maxInputTokens.localValue ?? ''}
          onChange={(e) => maxInputTokens.handleChange(e.target.value)}
          className="h-6 text-xs w-20 text-center"
          placeholder="—"
          min={1}
        />
      </td>
      <td className="p-2 text-center">
        <Input
          type="number"
          value={maxOutputTokens.localValue ?? ''}
          onChange={(e) => maxOutputTokens.handleChange(e.target.value)}
          className="h-6 text-xs w-20 text-center"
          placeholder="—"
          min={1}
        />
      </td>
      <td className="p-2 text-center">
        {!model.isReasoning ? (
          <Input
            type="number"
            value={temperature.localValue}
            onChange={(e) => temperature.handleChange(e.target.value)}
            className="h-6 text-xs w-16 text-center"
            placeholder="—"
            min={0}
            max={2}
            step={0.1}
          />
        ) : (
          <span className="text-foreground-muted">—</span>
        )}
      </td>
      <td className="p-2 text-center">
        <Input
          type="number"
          value={maxTokens.localValue}
          onChange={(e) => maxTokens.handleChange(e.target.value)}
          className="h-6 text-xs w-20 text-center"
          placeholder="—"
          min={1}
        />
      </td>
      <td className="p-2 text-center">
        {model.isReasoning ? (
          <select
            value={model.defaultReasoningEffort ?? ''}
            onChange={(e) => onUpdate(model.id, { defaultReasoningEffort: e.target.value || null })}
            className="h-6 text-xs border border-border-subtle rounded px-1 bg-background"
          >
            <option value="">—</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="extra-high">Extra High</option>
          </select>
        ) : (
          <span className="text-foreground-muted">—</span>
        )}
      </td>
      <td className="p-2 text-center">
        <Input
          type="number"
          value={inputCost.localValue}
          onChange={(e) => inputCost.handleChange(e.target.value)}
          className="h-6 text-xs w-20 text-center"
          placeholder="—"
          min={0}
          step={0.01}
        />
      </td>
      <td className="p-2 text-center">
        <Input
          type="number"
          value={outputCost.localValue}
          onChange={(e) => outputCost.handleChange(e.target.value)}
          className="h-6 text-xs w-20 text-center"
          placeholder="—"
          min={0}
          step={0.01}
        />
      </td>
      <td className="p-2 text-center">
        <button
          onClick={() =>
            onUpdate(model.id, { hasManualCostOverride: !model.hasManualCostOverride })
          }
          className={`transition-colors ${model.hasManualCostOverride ? 'text-warning' : 'text-foreground-muted hover:text-foreground'}`}
          title={
            model.hasManualCostOverride
              ? 'Costs locked — sync will not update this model. Click to unlock.'
              : 'Costs auto-synced from registry. Click to lock.'
          }
        >
          {model.hasManualCostOverride ? (
            <Lock className="size-3.5" />
          ) : (
            <LockOpen className="size-3.5" />
          )}
        </button>
      </td>
      <td className="p-2 text-center">
        <button
          onClick={() => onDelete(model.id)}
          className="text-destructive hover:text-destructive/80"
        >
          <X className="size-3.5" />
        </button>
      </td>
    </tr>
  );
});
