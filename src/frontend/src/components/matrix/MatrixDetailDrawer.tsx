import { Settings2 } from 'lucide-react';

import { ModelConfigPanel } from '@/components/matrix/ModelConfigPanel';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MatrixModel } from '@/types/matrix';

interface MatrixConfigSidebarProps {
  models: MatrixModel[];
  selectedModelId: string | null;
  onSelectModel: (modelId: string | null) => void;
  onParamChange: (modelId: string, params: Partial<Pick<MatrixModel, 'temperature' | 'maxTokens' | 'reasoningEffort' | 'showReasoning'>>) => void;
}

function formatModelParams(model: MatrixModel): string {
  if (model.isReasoning) {
    return `effort: ${model.reasoningEffort} · ${model.maxTokens} tok`;
  }
  return `t=${model.temperature.toFixed(1)} · ${model.maxTokens} tok`;
}

export function MatrixDetailDrawer({
  models,
  selectedModelId,
  onSelectModel,
  onParamChange,
}: MatrixConfigSidebarProps) {
  const selectedModel = selectedModelId
    ? models.find((m) => m.modelId === selectedModelId)
    : null;

  // Selected model — show config panel
  if (selectedModel) {
    return (
      <ScrollArea className="h-full">
        <ModelConfigPanel
          model={selectedModel}
          onParamChange={(params) => onParamChange(selectedModel.modelId, params)}
        />
      </ScrollArea>
    );
  }

  // Empty state — show all models summary
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Settings2 className="size-4" />
          Model Parameters
        </div>
        <p className="text-xs text-foreground-muted mt-1">
          Click a model row to configure its parameters
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {models.length === 0 ? (
            <p className="text-sm text-foreground-muted text-center py-8">
              Add models to the grid to configure parameters
            </p>
          ) : (
            models.map((model) => (
              <button
                key={model.modelId}
                onClick={() => onSelectModel(model.modelId)}
                className="w-full flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{model.displayName}</div>
                  <div className="text-xs text-foreground-muted">{formatModelParams(model)}</div>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {model.providerName}
                </Badge>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
