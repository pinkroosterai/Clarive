import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Server } from 'lucide-react';
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
          <p className="text-xs text-foreground-muted">Add an OpenAI-compatible provider to get started</p>
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
