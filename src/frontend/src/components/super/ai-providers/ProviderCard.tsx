import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Server,
  ShieldCheck,
  Trash2,
  Pencil,
} from 'lucide-react';

import ProviderCardExpanded from './ProviderCardExpanded';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AiProviderResponse, FetchedModelItem } from '@/services/api/aiProviderService';

export interface ProviderCardProps {
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

export default function ProviderCard({
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
    <div className="rounded-lg border border-border-subtle bg-surface">
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
            onClick={onValidate}
            disabled={isValidating}
          >
            {isValidating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
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
