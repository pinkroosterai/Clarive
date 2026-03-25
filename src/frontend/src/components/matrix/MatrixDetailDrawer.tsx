import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Loader2,
  Settings2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { CellScorecard } from '@/components/matrix/CellScorecard';
import { ModelConfigPanel } from '@/components/matrix/ModelConfigPanel';
import type { SetupTabContentProps } from '@/components/matrix/SetupTabContent';
import { SetupTabContent } from '@/components/matrix/SetupTabContent';
import { VersionPromptPreview } from '@/components/matrix/VersionPromptPreview';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  setupProps: Omit<SetupTabContentProps, 'entryId'>;
}

function formatModelParams(model: MatrixModel): string {
  if (model.isReasoning) {
    return `effort: ${model.reasoningEffort} · ${model.maxTokens} tok`;
  }
  return `t=${model.temperature.toFixed(1)} · ${model.maxTokens} tok`;
}

const contentAnimation = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25 },
};

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
  setupProps,
}: MatrixConfigSidebarProps) {
  const [activeTab, setActiveTab] = useState('setup');

  // Auto-switch tab based on selection
  useEffect(() => {
    if (selectedVersionId) {
      setActiveTab('preview');
    } else if (selectedCell) {
      setActiveTab('results');
    } else if (selectedModelId) {
      setActiveTab('config');
    }
  }, [selectedModelId, selectedVersionId, selectedCell]);

  // ── Collapsed strip ──
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 h-full">
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

  // ── Expanded sidebar ──
  const selectedModel = selectedModelId
    ? models.find((m) => m.modelId === selectedModelId)
    : null;

  const selectedCellData = selectedCell
    ? cells[cellKey(selectedCell.versionId, selectedCell.modelId)]
    : null;

  const selectedCellModel = selectedCell
    ? models.find((m) => m.modelId === selectedCell.modelId)
    : null;

  const selectedCellVersion = selectedCell
    ? versions.find((v) => v.id === selectedCell.versionId)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Tabbed content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 shrink-0">
          <TabsList className="flex-1">
          <TabsTrigger value="setup" className="flex-1 gap-1.5 text-xs">
            Setup
          </TabsTrigger>
          <TabsTrigger value="config" className="flex-1 gap-1.5 text-xs">
            Config
            {models.length > 0 && (
              <span className="inline-flex items-center justify-center size-4 rounded-full bg-muted-foreground/20 text-[10px] font-medium text-muted-foreground">
                {models.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-1 gap-1.5 text-xs">
            Preview
          </TabsTrigger>
          <TabsTrigger value="results" className="flex-1 gap-1.5 text-xs">
            Results
            {selectedCellData?.evaluation && (
              <span className="inline-flex items-center justify-center size-4 rounded-full bg-muted-foreground/20 text-[10px] font-medium text-muted-foreground">
                {Math.round(selectedCellData.evaluation.averageScore)}
              </span>
            )}
          </TabsTrigger>
          </TabsList>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-foreground-muted shrink-0"
                aria-label="Collapse sidebar"
              >
                <ChevronRight className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Collapse sidebar</TooltipContent>
          </Tooltip>
        </div>

        {/* Setup tab */}
        <TabsContent value="setup" className="flex-1 overflow-hidden pt-4">
          <ScrollArea className="h-full">
            <div className="pr-3">
              <SetupTabContent entryId={entryId} {...setupProps} />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Config tab */}
        <TabsContent value="config" className="flex-1 overflow-hidden pt-4">
          <ScrollArea className="h-full">
            <div className="pr-3">
              {selectedModel ? (
                <motion.div {...contentAnimation}>
                  <ModelConfigPanel
                    model={selectedModel}
                    onParamChange={(params) => onParamChange(selectedModel.modelId, params)}
                  />
                </motion.div>
              ) : (
                <>
                  <div className="pb-3">
                    <div className="flex items-center gap-2">
                      <Settings2 className="size-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Model Parameters</h3>
                    </div>
                    <p className="text-xs text-foreground-muted mt-1">
                      Click a model row to configure its parameters
                    </p>
                  </div>
                  <motion.div {...contentAnimation} className="space-y-1">
                    {models.length === 0 ? (
                      <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-8 flex flex-col items-center gap-3 text-center">
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
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Preview tab */}
        <TabsContent value="preview" className="flex-1 overflow-hidden pt-4">
          <ScrollArea className="h-full">
            <div className="pr-3">
              {versionContentLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : versionContent ? (
                <motion.div {...contentAnimation}>
                  <VersionPromptPreview
                    entryId={entryId}
                    content={versionContent}
                    fieldValues={fieldValues}
                  />
                </motion.div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-8 flex flex-col items-center gap-3 text-center">
                    <Eye className="size-8 text-foreground-muted" />
                    <p className="text-sm text-foreground-muted">
                      Click a version row to preview its content
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Results tab */}
        <TabsContent value="results" className="flex-1 overflow-hidden pt-4">
          <ScrollArea className="h-full">
            <div className="pr-3">
              {selectedCellData?.evaluation ? (
                <motion.div {...contentAnimation}>
                  <CellScorecard
                    modelName={selectedCellModel?.displayName ?? 'Unknown'}
                    versionLabel={selectedCellVersion?.label ?? 'Unknown'}
                    evaluation={selectedCellData.evaluation}
                    elapsedMs={selectedCellData.elapsedMs}
                  />
                </motion.div>
              ) : selectedCellData?.status === 'running' ? (
                <motion.div {...contentAnimation} className="flex flex-col items-center justify-center gap-3 p-8">
                  <Loader2 className="size-8 text-foreground-muted animate-spin" />
                  <p className="text-sm text-foreground-muted">Evaluating...</p>
                </motion.div>
              ) : selectedCell ? (
                <motion.div {...contentAnimation} className="flex items-center justify-center p-8">
                  <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-8 flex flex-col items-center gap-3 text-center">
                    <ClipboardCheck className="size-8 text-foreground-muted" />
                    <p className="text-sm text-foreground-muted">Not scored yet</p>
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center justify-center p-8">
                  <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-8 flex flex-col items-center gap-3 text-center">
                    <ClipboardCheck className="size-8 text-foreground-muted" />
                    <p className="text-sm text-foreground-muted">
                      Click a grid cell to view its results
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
