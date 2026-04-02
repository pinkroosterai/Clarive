import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Server, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import ProviderCard from './ai-providers/ProviderCard';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handleApiError';
import {
  PROVIDER_PRESETS,
  CUSTOM_PRESET,
  type ProviderPreset,
} from '@/lib/providerPresets';
import {
  getProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  fetchModels,
  validateProvider,
  addModel,
  updateModel,
  deleteModel,
  type AiProviderResponse,
  type FetchedModelItem,
} from '@/services/api/aiProviderService';

export default function AiProvidersSection() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AiProviderResponse | null>(null);
  const [formName, setFormName] = useState('');
  const [formEndpoint, setFormEndpoint] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formHeaders, setFormHeaders] = useState<Record<string, string>>({});
  const [formApiMode, setFormApiMode] = useState<string | undefined>(undefined);
  const [formUseProviderPricing, setFormUseProviderPricing] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null);

  // ── Queries ──
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['super', 'ai-providers'],
    queryFn: getProviders,
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: () =>
      createProvider({
        name: formName,
        endpointUrl: formEndpoint || undefined,
        apiKey: formApiKey,
        apiMode: formApiMode || undefined,
        customHeaders: Object.keys(formHeaders).length > 0 ? formHeaders : undefined,
        useProviderPricing: formUseProviderPricing || undefined,
      }),
    onSuccess: () => {
      toast.success('Provider created');
      queryClient.invalidateQueries({ queryKey: ['super', 'ai-providers'] });
      closeDialog();
    },
    onError: (err) => handleApiError(err, { fallback: 'Failed to create provider' }),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      updateProvider(id, {
        name: formName || undefined,
        endpointUrl: formEndpoint,
        apiKey: formApiKey || undefined,
        customHeaders: formHeaders,
      }),
    onSuccess: () => {
      toast.success('Provider updated');
      queryClient.invalidateQueries({ queryKey: ['super', 'ai-providers'] });
      closeDialog();
    },
    onError: (err) => handleApiError(err, { fallback: 'Failed to update provider' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProvider,
    onSuccess: () => {
      toast.success('Provider deleted');
      queryClient.invalidateQueries({ queryKey: ['super', 'ai-providers'] });
    },
    onError: (err) => handleApiError(err, { fallback: 'Failed to delete provider' }),
  });

  const inlineUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super', 'ai-providers'] });
    },
    onError: (err) => handleApiError(err, { fallback: 'Failed to update provider' }),
  });

  const validateMutation = useMutation({
    mutationFn: validateProvider,
    onSuccess: () => toast.success('API key is valid'),
    onError: (err) => handleApiError(err, { fallback: 'Validation failed' }),
  });

  const fetchModelsMutation = useMutation({
    mutationFn: fetchModels,
  });

  const addModelMutation = useMutation({
    mutationFn: ({
      providerId,
      model,
    }: {
      providerId: string;
      model: FetchedModelItem;
    }) =>
      addModel(providerId, {
        modelId: model.modelId,
        isReasoning: model.isReasoning,
        supportsFunctionCalling: model.supportsFunctionCalling,
        supportsResponseSchema: model.supportsResponseSchema,
        maxInputTokens: model.maxInputTokens,
        maxOutputTokens: model.maxOutputTokens,
        inputCostPerMillion: model.inputCostPerMillion,
        outputCostPerMillion: model.outputCostPerMillion,
        defaultReasoningEffort: model.isReasoning ? 'medium' : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super', 'ai-providers'] });
    },
    onError: (err) => handleApiError(err, { fallback: 'Failed to add model' }),
  });

  const updateModelMutation = useMutation({
    mutationFn: ({
      providerId,
      modelId,
      data,
    }: {
      providerId: string;
      modelId: string;
      data: Record<string, unknown>;
    }) => updateModel(providerId, modelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super', 'ai-providers'] });
    },
    onError: (err) => handleApiError(err, { fallback: 'Failed to update model' }),
  });

  const deleteModelMutation = useMutation({
    mutationFn: ({ providerId, modelId }: { providerId: string; modelId: string }) =>
      deleteModel(providerId, modelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super', 'ai-providers'] });
    },
    onError: (err) => handleApiError(err, { fallback: 'Failed to remove model' }),
  });

  // ── Helpers ──
  const openCreateDialog = () => {
    setEditingProvider(null);
    setSelectedPreset(null);
    setFormName('');
    setFormEndpoint('');
    setFormApiKey('');
    setFormHeaders({});
    setFormApiMode(undefined);
    setFormUseProviderPricing(false);
    setDialogOpen(true);
  };

  const openEditDialog = (provider: AiProviderResponse) => {
    setEditingProvider(provider);
    setSelectedPreset(null);
    setFormName(provider.name);
    setFormEndpoint(provider.endpointUrl || '');
    setFormApiKey('');
    setFormHeaders(provider.customHeaders ?? {});
    setFormApiMode(undefined);
    setFormUseProviderPricing(false);
    setDialogOpen(true);
  };

  const selectPreset = (preset: ProviderPreset) => {
    setSelectedPreset(preset);
    setFormName(preset.name);
    setFormEndpoint(preset.endpointUrl);
    setFormHeaders({ ...preset.customHeaders });
    setFormApiMode(preset.apiMode || undefined);
    setFormUseProviderPricing(preset.useProviderPricing);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProvider(null);
    setSelectedPreset(null);
  };

  const handleSave = () => {
    if (editingProvider) {
      updateMutation.mutate(editingProvider.id);
    } else {
      createMutation.mutate();
    }
  };

  const handleFetchAndShow = async (providerId: string) => {
    try {
      const result = await fetchModelsMutation.mutateAsync(providerId);
      return result.models;
    } catch {
      return [];
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">
          Configure AI providers and select which models to make available.
        </p>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="size-4 mr-1.5" />
          Add Provider
        </Button>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-12 flex flex-col items-center gap-3 text-center">
          <Server className="size-10 text-foreground-muted" />
          <p className="text-sm text-foreground-muted">No providers configured</p>
          <p className="text-xs text-foreground-muted">
            Add an OpenAI-compatible provider to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isExpanded={expandedId === provider.id}
              onToggle={() => setExpandedId(expandedId === provider.id ? null : provider.id)}
              onEdit={() => openEditDialog(provider)}
              onDelete={() => deleteMutation.mutate(provider.id)}
              onValidate={() => validateMutation.mutate(provider.id)}
              onFetchModels={() => handleFetchAndShow(provider.id)}
              onAddModel={(model) =>
                addModelMutation.mutate({ providerId: provider.id, model })
              }
              onUpdateModel={(modelId, data) =>
                updateModelMutation.mutate({ providerId: provider.id, modelId, data })
              }
              onDeleteModel={(modelId) =>
                deleteModelMutation.mutate({ providerId: provider.id, modelId })
              }
              onUpdateProvider={(data) => inlineUpdateMutation.mutate({ id: provider.id, data })}
              isValidating={
                validateMutation.isPending && validateMutation.variables === provider.id
              }
              isFetchingModels={fetchModelsMutation.isPending}
              fetchedModels={
                fetchModelsMutation.isSuccess && fetchModelsMutation.variables === provider.id
                  ? (fetchModelsMutation.data?.models ?? [])
                  : null
              }
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add Provider'}</DialogTitle>
          </DialogHeader>

          {/* Preset selector grid (create mode only, before preset is chosen) */}
          {!editingProvider && !selectedPreset ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground-muted">Choose a provider to get started:</p>
              <div className="grid grid-cols-2 gap-2">
                {[...PROVIDER_PRESETS, CUSTOM_PRESET].map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => selectPreset(preset)}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border-subtle hover:border-primary hover:bg-elevated/50 text-left transition-colors"
                    >
                      <Icon className="size-5 mt-0.5 text-foreground-muted shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{preset.label}</p>
                        <p className="text-xs text-foreground-muted line-clamp-2">
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Back to preset selector (create mode only) */}
              {!editingProvider && selectedPreset && (
                <button
                  onClick={() => setSelectedPreset(null)}
                  className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground -mt-2 mb-1"
                >
                  <ArrowLeft className="size-3" />
                  Change provider type
                </button>
              )}

              {/* Form fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., OpenAI, Azure OpenAI, Ollama"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Endpoint URL</Label>
                  <Input
                    value={formEndpoint}
                    onChange={(e) => setFormEndpoint(e.target.value)}
                    placeholder="Leave empty for default OpenAI endpoint"
                    autoComplete="off"
                  />
                  <p className="text-xs text-foreground-muted">
                    For custom providers: https://your-endpoint.com/v1
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder={editingProvider ? 'Leave empty to keep current key' : 'sk-...'}
                    autoComplete="new-password"
                  />
                </div>
                {/* Custom Headers (collapsible) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-foreground-muted">
                      Custom Headers (optional)
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setFormHeaders({ ...formHeaders, '': '' })}
                    >
                      <Plus className="size-3 mr-1" /> Add
                    </Button>
                  </div>
                  {Object.keys(formHeaders).length > 0 && (
                    <div className="space-y-1.5">
                      {Object.entries(formHeaders).map(([key, value], index) => (
                        <div key={`header-${key || index}`} className="flex items-center gap-1.5">
                          <Input
                            value={key}
                            onChange={(e) => {
                              const updated: Record<string, string> = {};
                              for (const [k, v] of Object.entries(formHeaders)) {
                                updated[k === key ? e.target.value : k] = v;
                              }
                              setFormHeaders(updated);
                            }}
                            className="h-7 text-xs flex-1 font-mono"
                            placeholder="Header name"
                          />
                          <Input
                            value={value}
                            onChange={(e) =>
                              setFormHeaders({ ...formHeaders, [key]: e.target.value })
                            }
                            className="h-7 text-xs flex-1"
                            placeholder="Value"
                          />
                          <button
                            onClick={() => {
                              const updated = { ...formHeaders };
                              delete updated[key];
                              setFormHeaders(updated);
                            }}
                            className="text-destructive hover:text-destructive/80 shrink-0"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    !formName ||
                    (!editingProvider && !formApiKey) ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
