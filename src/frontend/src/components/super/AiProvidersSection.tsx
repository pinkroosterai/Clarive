import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Pencil,
  X,
  Brain,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { handleApiError } from '@/lib/handleApiError';
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
  type AiProviderModelResponse,
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
      modelId,
      isReasoning,
    }: {
      providerId: string;
      modelId: string;
      isReasoning?: boolean;
    }) =>
      addModel(providerId, {
        modelId,
        isReasoning,
        defaultReasoningEffort: isReasoning ? 'medium' : undefined,
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
    setFormName('');
    setFormEndpoint('');
    setFormApiKey('');
    setDialogOpen(true);
  };

  const openEditDialog = (provider: AiProviderResponse) => {
    setEditingProvider(provider);
    setFormName(provider.name);
    setFormEndpoint(provider.endpointUrl || '');
    setFormApiKey('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProvider(null);
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
      <div className="flex items-center gap-2 py-8 text-foreground-muted">
        <Loader2 className="size-4 animate-spin" />
        Loading providers...
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
        <div className="text-center py-12 text-foreground-muted">
          <Server className="size-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No providers configured</p>
          <p className="text-xs mt-1">Add an OpenAI-compatible provider to get started</p>
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
              onAddModel={(modelId, isReasoning) =>
                addModelMutation.mutate({ providerId: provider.id, modelId, isReasoning })
              }
              onUpdateModel={(modelId, data) =>
                updateModelMutation.mutate({ providerId: provider.id, modelId, data })
              }
              onDeleteModel={(modelId) =>
                deleteModelMutation.mutate({ providerId: provider.id, modelId })
              }
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add Provider'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., OpenAI, Azure OpenAI, Ollama"
              />
            </div>
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input
                value={formEndpoint}
                onChange={(e) => setFormEndpoint(e.target.value)}
                placeholder="Leave empty for default OpenAI endpoint"
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
              />
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Provider Card ──

interface ProviderCardProps {
  provider: AiProviderResponse;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onValidate: () => void;
  onFetchModels: () => Promise<FetchedModelItem[]>;
  onAddModel: (modelId: string, isReasoning?: boolean) => void;
  onUpdateModel: (modelId: string, data: Record<string, unknown>) => void;
  onDeleteModel: (modelId: string) => void;
  isValidating: boolean;
  isFetchingModels: boolean;
  fetchedModels: FetchedModelItem[] | null;
}

function ProviderCard({
  provider,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onValidate,
  onFetchModels,
  onAddModel,
  onUpdateModel,
  onDeleteModel,
  isValidating,
  isFetchingModels,
  fetchedModels,
}: ProviderCardProps) {
  const activeModels = provider.models.filter((m) => m.isActive);

  return (
    <div className="border border-border-subtle rounded-lg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className="shrink-0">
          {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <Server className="size-4 text-foreground-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{provider.name}</span>
            {provider.isActive ? (
              <Badge variant="outline" className="text-xs text-success-text border-success-border">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-foreground-muted">
                Inactive
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {activeModels.length} models
            </Badge>
          </div>
          {provider.endpointUrl && (
            <p className="text-xs text-foreground-muted truncate">{provider.endpointUrl}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onValidate}
            disabled={isValidating}
          >
            {isValidating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <ProviderCardExpanded
          provider={provider}
          onFetchModels={onFetchModels}
          onAddModel={onAddModel}
          onUpdateModel={onUpdateModel}
          onDeleteModel={onDeleteModel}
          isFetchingModels={isFetchingModels}
          fetchedModels={fetchedModels}
        />
      )}
    </div>
  );
}

// ── Provider Card Expanded Content ──

function ProviderCardExpanded({
  provider,
  onFetchModels,
  onAddModel,
  onUpdateModel,
  onDeleteModel,
  isFetchingModels,
  fetchedModels,
}: {
  provider: AiProviderResponse;
  onFetchModels: () => Promise<FetchedModelItem[]>;
  onAddModel: (modelId: string, isReasoning?: boolean) => void;
  onUpdateModel: (modelId: string, data: Record<string, unknown>) => void;
  onDeleteModel: (modelId: string) => void;
  isFetchingModels: boolean;
  fetchedModels: FetchedModelItem[] | null;
}) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Map<string, boolean>>(new Map());

  const availableModels = useMemo(() => {
    if (!fetchedModels) return [];
    return fetchedModels
      .filter((m) => !provider.models.some((pm) => pm.modelId === m.modelId))
      .map((m) => ({
        ...m,
        isReasoning: typeOverrides.has(m.modelId) ? typeOverrides.get(m.modelId)! : m.isReasoning,
      }));
  }, [fetchedModels, provider.models, typeOverrides]);

  const handleToggleType = (modelId: string, currentIsReasoning: boolean) => {
    setTypeOverrides((prev) => {
      const next = new Map(prev);
      next.set(modelId, !currentIsReasoning);
      return next;
    });
  };

  const handleAddModel = (modelId: string) => {
    const model = availableModels.find((m) => m.modelId === modelId);
    onAddModel(modelId, model?.isReasoning);
    // Keep popover open for multi-add convenience
  };

  return (
    <div className="border-t border-border-subtle px-4 py-3 space-y-4">
      {/* Add Model — searchable dropdown + fetch button */}
      <div className="space-y-2">
        <Label className="text-xs text-foreground-muted">Add Model</Label>
        <div className="flex items-center gap-2">
          <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={selectorOpen}
                className="max-w-sm w-full justify-between text-xs"
                size="sm"
                disabled={!fetchedModels}
              >
                {isFetchingModels ? (
                  <span className="flex items-center gap-2 text-foreground-muted">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading models...
                  </span>
                ) : !fetchedModels ? (
                  <span className="text-foreground-muted">Fetch models first</span>
                ) : availableModels.length === 0 ? (
                  <span className="text-foreground-muted">All models added</span>
                ) : (
                  <span className="text-foreground-muted">
                    Select model to add ({availableModels.length} available)
                  </span>
                )}
                <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="max-w-sm w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search models..." className="text-xs" />
                <CommandList>
                  <CommandEmpty>No matching models.</CommandEmpty>
                  <CommandGroup>
                    {availableModels.map((m) => (
                      <CommandItem
                        key={m.modelId}
                        value={m.modelId}
                        onSelect={() => handleAddModel(m.modelId)}
                        className="text-xs font-mono"
                      >
                        <Plus className="mr-2 size-3.5 text-foreground-muted" />
                        <span className="flex-1">{m.modelId}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleType(m.modelId, m.isReasoning);
                          }}
                          className="ml-2 shrink-0"
                          title="Click to toggle model type"
                        >
                          <Badge
                            variant={m.isReasoning ? 'default' : 'outline'}
                            className="text-[10px] px-1.5 py-0 cursor-pointer"
                          >
                            {m.isReasoning ? '🧠 Reasoning' : 'Standard'}
                          </Badge>
                        </button>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={onFetchModels}
            disabled={isFetchingModels}
            title="Fetch available models from provider"
          >
            {isFetchingModels ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Configured models table */}
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
                  <th className="text-center p-2 font-medium" title="Reasoning model toggle">
                    <Brain className="size-3.5 mx-auto" />
                  </th>
                  <th className="text-center p-2 font-medium" title="Max context window size (tokens)">
                    Context Size
                  </th>
                  <th className="text-center p-2 font-medium" title="Default temperature for this model (0-2)">
                    Default Temp
                  </th>
                  <th className="text-center p-2 font-medium" title="Default max output tokens for this model">
                    Default Max Tokens
                  </th>
                  <th className="text-center p-2 font-medium" title="Default reasoning effort for reasoning models">
                    Default Effort
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

// ── Model Row ──

function useDebouncedUpdate(
  modelId: string,
  field: string,
  serverValue: string | number | null | undefined,
  onUpdate: (modelId: string, data: Record<string, unknown>) => void,
  transform: (value: string) => unknown,
  delay = 500
) {
  const [localValue, setLocalValue] = useState(String(serverValue ?? ''));
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isLocalEdit = useRef(false);

  // Sync from server when not actively editing
  useEffect(() => {
    if (!isLocalEdit.current) {
      setLocalValue(String(serverValue ?? ''));
    }
  }, [serverValue]);

  const handleChange = (value: string) => {
    isLocalEdit.current = true;
    setLocalValue(value);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onUpdate(modelId, { [field]: transform(value) });
      isLocalEdit.current = false;
    }, delay);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { localValue, handleChange };
}

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
  const contextSize = useDebouncedUpdate(
    model.id,
    'maxContextSize',
    model.maxContextSize,
    onUpdate,
    (v) => Number(v) || 128000
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
        <Input
          type="number"
          value={contextSize.localValue}
          onChange={(e) => contextSize.handleChange(e.target.value)}
          className="h-6 text-xs w-20 text-center"
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
          max={32000}
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
        <button onClick={() => onDelete(model.id)} className="text-destructive hover:text-destructive/80">
          <X className="size-3.5" />
        </button>
      </td>
    </tr>
  );
});
