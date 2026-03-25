import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Settings2 } from 'lucide-react';

import { CellScorecard } from '@/components/matrix/CellScorecard';
import { ModelConfigPanel } from '@/components/matrix/ModelConfigPanel';
import { VersionPromptPreview } from '@/components/matrix/VersionPromptPreview';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PromptEntry } from '@/types';
import type { CellKey, MatrixCell, MatrixModel, MatrixVersion } from '@/types/matrix';
import { cellKey } from '@/types/matrix';

interface MatrixConfigSidebarProps {
  entryId: string;
  models: MatrixModel[];
  versions: MatrixVersion[];
  selectedModelId: string | null;
  selectedVersionId: string | null;
  selectedCell: CellKey | null;
  cells: Record<string, MatrixCell>;
  versionContent?: PromptEntry;
  versionContentLoading: boolean;
  fieldValues: Record<string, string>;
  onSelectModel: (modelId: string | null) => void;
  onParamChange: (modelId: string, params: Partial<Pick<MatrixModel, 'temperature' | 'maxTokens' | 'reasoningEffort' | 'showReasoning'>>) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onExpandToSection: () => void;
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
  versions,
  selectedModelId,
  selectedVersionId,
  selectedCell,
  cells,
  versionContent,
  versionContentLoading,
  fieldValues,
  onSelectModel,
  onParamChange,
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
              onClick={onExpandToSection}
              className="p-2 rounded-md hover:bg-muted/50 transition-colors text-foreground-muted hover:text-foreground"
              aria-label="Model Parameters"
            >
              <Settings2 className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Model Parameters</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // ── Expanded drawer ──
  const selectedModel = selectedModelId
    ? models.find((m) => m.modelId === selectedModelId)
    : null;

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

  const contentAnimation = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25 },
  };

  // ── Version preview mode ──
  if (selectedVersionId && (versionContent || versionContentLoading)) {
    return (
      <div className="flex flex-col h-full">
        {collapseButton}
        <ScrollArea className="flex-1">
          <motion.div {...contentAnimation}>
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
          </motion.div>
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
          <motion.div {...contentAnimation}>
            <ModelConfigPanel
              model={selectedModel}
              onParamChange={(params) => onParamChange(selectedModel.modelId, params)}
            />
          </motion.div>
        </ScrollArea>
      </div>
    );
  }

  // ── Cell scorecard mode ──
  if (selectedCell) {
    const key = cellKey(selectedCell.versionId, selectedCell.modelId);
    const cell = cells[key];
    const model = models.find((m) => m.modelId === selectedCell.modelId);
    const version = versions.find((v) => v.id === selectedCell.versionId);

    if (cell?.evaluation) {
      return (
        <div className="flex flex-col h-full">
          {collapseButton}
          <ScrollArea className="flex-1">
            <motion.div {...contentAnimation}>
              <CellScorecard
                modelName={model?.displayName ?? 'Unknown'}
                versionLabel={version?.label ?? 'Unknown'}
                evaluation={cell.evaluation}
                elapsedMs={cell.elapsedMs}
              />
            </motion.div>
          </ScrollArea>
        </div>
      );
    }

    if (cell?.status === 'running') {
      return (
        <div className="flex flex-col h-full">
          {collapseButton}
          <motion.div {...contentAnimation} className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
            <Loader2 className="size-8 text-foreground-muted animate-spin" />
            <p className="text-sm text-foreground-muted">Evaluating...</p>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {collapseButton}
        <motion.div {...contentAnimation} className="flex-1 flex items-center justify-center p-4">
          <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-8 flex flex-col items-center gap-3 text-center">
            <ClipboardCheck className="size-8 text-foreground-muted" />
            <p className="text-sm text-foreground-muted">Not scored yet</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Empty state — show all models summary
  return (
    <div className="flex flex-col h-full">
      {collapseButton}
      <div className="p-4 border-b border-border-subtle shrink-0 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
            Model Parameters
          </h3>
          <div className="flex-1 border-b border-border" />
        </div>
        <p className="text-xs text-foreground-muted">
          Click a model row to configure its parameters
        </p>
      </div>
      <ScrollArea className="flex-1">
        <motion.div {...contentAnimation} className="p-2 space-y-1">
          {models.length === 0 ? (
            <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-8 mx-2 flex flex-col items-center gap-3 text-center">
              <Settings2 className="size-8 text-foreground-muted" />
              <p className="text-sm text-foreground-muted">
                Add models to the grid to configure parameters
              </p>
            </div>
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
        </motion.div>
      </ScrollArea>
    </div>
  );
}
