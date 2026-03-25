import { ChevronLeft, ChevronRight, Settings2, Wrench } from 'lucide-react';

import { MatrixToolsPanel } from '@/components/matrix/MatrixToolsPanel';
import { ModelConfigPanel } from '@/components/matrix/ModelConfigPanel';
import { VersionPromptPreview } from '@/components/matrix/VersionPromptPreview';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { McpServer, ToolDescription, PromptEntry } from '@/types';
import type { MatrixModel } from '@/types/matrix';

interface MatrixConfigSidebarProps {
  entryId: string;
  models: MatrixModel[];
  selectedModelId: string | null;
  selectedVersionId: string | null;
  versionContent?: PromptEntry;
  versionContentLoading: boolean;
  fieldValues: Record<string, string>;
  onSelectModel: (modelId: string | null) => void;
  onParamChange: (modelId: string, params: Partial<Pick<MatrixModel, 'temperature' | 'maxTokens' | 'reasoningEffort' | 'showReasoning'>>) => void;
  mcpServers: McpServer[];
  allTools: ToolDescription[];
  enabledServerIds: string[];
  setEnabledServerIds: (ids: string[]) => void;
  excludedToolNames: string[];
  setExcludedToolNames: (names: string[]) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onExpandToSection: (section: 'config' | 'tools') => void;
}

function formatModelParams(model: MatrixModel): string {
  if (model.isReasoning) {
    return `effort: ${model.reasoningEffort} · ${model.maxTokens} tok`;
  }
  return `t=${model.temperature.toFixed(1)} · ${model.maxTokens} tok`;
}

export function MatrixDetailDrawer({
  entryId,
  models,
  selectedModelId,
  selectedVersionId,
  versionContent,
  versionContentLoading,
  fieldValues,
  onSelectModel,
  onParamChange,
  mcpServers,
  allTools,
  enabledServerIds,
  setEnabledServerIds,
  excludedToolNames,
  setExcludedToolNames,
  collapsed,
  onToggleCollapse,
  onExpandToSection,
}: MatrixConfigSidebarProps) {
  // ── Collapsed strip ──
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 h-full">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-foreground-muted"
              aria-label="Expand sidebar"
            >
              <ChevronLeft className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Expand sidebar</TooltipContent>
        </Tooltip>
        <div className="w-6 border-t border-border-subtle" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onExpandToSection('config')}
              className="p-2 rounded-md hover:bg-muted/50 transition-colors text-foreground-muted hover:text-foreground"
              aria-label="Model Parameters"
            >
              <Settings2 className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Model Parameters</TooltipContent>
        </Tooltip>
        {mcpServers.some((s) => s.isActive) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onExpandToSection('tools')}
                className="p-2 rounded-md hover:bg-muted/50 transition-colors text-foreground-muted hover:text-foreground"
                aria-label="Tools"
              >
                <Wrench className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Tools</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  // ── Expanded drawer — model config ──
  const selectedModel = selectedModelId
    ? models.find((m) => m.modelId === selectedModelId)
    : null;

  const toolsPanel = mcpServers.some((s) => s.isActive) ? (
    <MatrixToolsPanel
      mcpServers={mcpServers}
      allTools={allTools}
      enabledServerIds={enabledServerIds}
      setEnabledServerIds={setEnabledServerIds}
      excludedToolNames={excludedToolNames}
      setExcludedToolNames={setExcludedToolNames}
    />
  ) : null;

  const collapseButton = (
    <div className="flex justify-end p-1 border-b border-border-subtle shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded-md hover:bg-muted/50 transition-colors text-foreground-muted"
            aria-label="Collapse sidebar"
          >
            <ChevronRight className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Collapse sidebar</TooltipContent>
      </Tooltip>
    </div>
  );

  // ── Version preview mode ──
  if (selectedVersionId && (versionContent || versionContentLoading)) {
    return (
      <div className="flex flex-col h-full">
        {collapseButton}
        <ScrollArea className="flex-1">
          {versionContentLoading ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : versionContent ? (
            <VersionPromptPreview
              entryId={entryId}
              content={versionContent}
              fieldValues={fieldValues}
            />
          ) : null}
          {toolsPanel}
        </ScrollArea>
      </div>
    );
  }

  // Selected model — show config panel
  if (selectedModel) {
    return (
      <div className="flex flex-col h-full">
        {collapseButton}
        <ScrollArea className="flex-1">
          <ModelConfigPanel
            model={selectedModel}
            onParamChange={(params) => onParamChange(selectedModel.modelId, params)}
          />
          {toolsPanel}
        </ScrollArea>
      </div>
    );
  }

  // Empty state — show all models summary
  return (
    <div className="flex flex-col h-full">
      {collapseButton}
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
        {toolsPanel}
      </ScrollArea>
    </div>
  );
}
