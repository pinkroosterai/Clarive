import { ArrowLeft, ChevronsUpDown, Clock, Database, Play, Plus, Square, Trash2, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { MatrixToolsPanel } from '@/components/matrix/MatrixToolsPanel';
import { TemplateVariablesSection } from '@/components/playground/TemplateVariablesSection';
import type { PlaygroundTemplateState } from '@/components/playground/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { EnrichedModel } from '@/services/api/playgroundService';
import type { MatrixModel, MatrixVersion } from '@/types/matrix';
import { enrichedModelToMatrixModel } from '@/types/matrix';
import type { TestDataset } from '@/services/api/testDatasetService';
import { Badge } from '@/components/ui/badge';
import type { McpServer, ToolDescription, VersionInfo, TabInfo } from '@/types';

interface MatrixToolbarProps {
  entryId: string;
  models: EnrichedModel[];
  versions: VersionInfo[];
  tabs: TabInfo[];
  datasets: TestDataset[];
  selectedDatasetId: string | null;
  onDatasetChange: (datasetId: string | null) => void;
  template: PlaygroundTemplateState;
  onAddVersion: (version: MatrixVersion) => void;
  onAddModel: (model: MatrixModel) => void;
  onRunAll: () => void;
  onAbortAll: () => void;
  isRunning: boolean;
  batchProgress: { current: number; total: number } | null;
  matrixHasCells: boolean;
  onClearMatrix: () => void;
  showHistory: boolean;
  onToggleHistory: () => void;
  mcpServers: McpServer[];
  allTools: ToolDescription[];
  enabledServerIds: string[];
  setEnabledServerIds: (ids: string[]) => void;
  excludedToolNames: string[];
  setExcludedToolNames: (names: string[]) => void;
  addedVersionIds: Set<string>;
  addedModelIds: Set<string>;
}

function groupModelsByProvider(models: EnrichedModel[]) {
  const groups = new Map<string, EnrichedModel[]>();
  for (const model of models) {
    const key = model.providerName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(model);
  }
  return groups;
}

export function MatrixToolbar({
  entryId,
  models,
  versions,
  tabs,
  datasets,
  selectedDatasetId,
  onDatasetChange,
  template,
  onAddVersion,
  onAddModel,
  onRunAll,
  onAbortAll,
  isRunning,
  batchProgress,
  matrixHasCells,
  onClearMatrix,
  showHistory,
  onToggleHistory,
  mcpServers,
  allTools,
  enabledServerIds,
  setEnabledServerIds,
  excludedToolNames,
  setExcludedToolNames,
  addedVersionIds,
  addedModelIds,
}: MatrixToolbarProps) {
  const navigate = useNavigate();
  const providerGroups = useMemo(() => groupModelsByProvider(models), [models]);
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const handleAddModel = (modelId: string) => {
    const model = models.find((m) => m.modelId === modelId);
    if (model) onAddModel(enrichedModelToMatrixModel(model));
  };

  const handleAddVersion = (id: string) => {
    // Check tabs first
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      onAddVersion({
        id: tab.id,
        label: tab.name,
        type: 'tab',
        tabName: tab.name,
      });
      return;
    }
    // Check versions
    const version = versions.find((v) => v.id === id);
    if (version) {
      onAddVersion({
        id: version.id,
        label:
          version.versionState === 'published'
            ? 'Published'
            : version.tabName ?? `v${version.version}`,
        type: version.versionState,
        version: version.version,
        tabName: version.tabName,
      });
    }
  };

  // Build version options: tabs first, then published, then historical (exclude already-added)
  const versionOptions: { id: string; label: string; group: string }[] = [];
  for (const tab of tabs) {
    if (!addedVersionIds.has(tab.id))
      versionOptions.push({ id: tab.id, label: tab.name, group: 'Tabs' });
  }
  for (const v of versions) {
    if (v.versionState === 'published' && !addedVersionIds.has(v.id))
      versionOptions.push({ id: v.id, label: `Published (v${v.version})`, group: 'Published' });
  }
  for (const v of versions) {
    if (v.versionState === 'historical' && !addedVersionIds.has(v.id))
      versionOptions.push({ id: v.id, label: `v${v.version} (historical)`, group: 'History' });
  }

  const allModelsAdded = models.length > 0 && models.every((m) => addedModelIds.has(m.modelId));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {/* Primary zone: navigation + add controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => navigate(`/entry/${entryId}`)}
              aria-label="Back to editor"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to editor</TooltipContent>
        </Tooltip>

        <Popover open={versionPickerOpen} onOpenChange={setVersionPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={versionPickerOpen}
              className="w-[180px] justify-between"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="size-3.5" />
                Add Version
              </div>
              <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search versions..." />
              <CommandList>
                <CommandEmpty>{versionOptions.length === 0 ? 'All versions added' : 'No versions found.'}</CommandEmpty>
                {['Tabs', 'Published', 'History'].map((group) => {
                  const items = versionOptions.filter((v) => v.group === group);
                  if (items.length === 0) return null;
                  return (
                    <CommandGroup key={group} heading={group}>
                      {items.map((item) => (
                        <CommandItem
                          key={item.id}
                          value={`${group} ${item.label}`}
                          onSelect={() => handleAddVersion(item.id)}
                        >
                          {item.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={modelPickerOpen}
              className="w-[200px] justify-between"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="size-3.5" />
                Add Model
              </div>
              <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search models..." />
              <CommandList>
                <CommandEmpty>{allModelsAdded ? 'All models added' : 'No models found.'}</CommandEmpty>
                {Array.from(providerGroups.entries()).map(([provider, providerModels]) => {
                  const available = providerModels.filter((m) => !addedModelIds.has(m.modelId));
                  if (available.length === 0) return null;
                  return (
                    <CommandGroup key={provider} heading={provider}>
                      {available.map((m) => (
                        <CommandItem
                          key={m.modelId}
                          value={`${provider} ${m.displayName ?? m.modelId}`}
                          onSelect={() => handleAddModel(m.modelId)}
                        >
                          {m.displayName ?? m.modelId}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6" />

        {/* Run zone */}
        {isRunning ? (
          <Button variant="destructive" size="sm" className="gap-2" onClick={onAbortAll}>
            <Square className="size-3.5" />
            Stop
            {batchProgress && (
              <span className="text-xs opacity-80">
                ({batchProgress.current}/{batchProgress.total})
              </span>
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-2"
            onClick={onRunAll}
            disabled={!matrixHasCells}
          >
            <Play className="size-3.5" />
            Run All
          </Button>
        )}

        {/* Spacer pushes secondary zone right */}
        <div className="flex-1" />

        {/* Secondary zone: tools, dataset, history, clear */}
        <div className="flex items-center gap-1">
          {mcpServers.some((s) => s.isActive) && (
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant={enabledServerIds.length > 0 ? 'secondary' : 'ghost'}
                      size="icon"
                      className="relative size-8 shrink-0"
                      aria-label="Configure tools"
                    >
                      <Wrench className="size-4" />
                      {enabledServerIds.length > 0 && (
                        <Badge variant="secondary" className="absolute -top-1 -right-1 size-4 p-0 flex items-center justify-center text-[9px]">
                          {enabledServerIds.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Tools</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-[300px] p-0" align="end">
                <MatrixToolsPanel
                  mcpServers={mcpServers}
                  allTools={allTools}
                  enabledServerIds={enabledServerIds}
                  setEnabledServerIds={setEnabledServerIds}
                  excludedToolNames={excludedToolNames}
                  setExcludedToolNames={setExcludedToolNames}
                />
              </PopoverContent>
            </Popover>
          )}
          {datasets.length > 0 && (
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant={selectedDatasetId ? 'secondary' : 'ghost'}
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Select dataset"
                    >
                      <Database className="size-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedDatasetId
                    ? datasets.find((d) => d.id === selectedDatasetId)?.name ?? 'Dataset'
                    : 'Select dataset'}
                </TooltipContent>
              </Tooltip>
              <PopoverContent className="w-[200px] p-1" align="end">
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted/50 transition-colors"
                  onClick={() => onDatasetChange(null)}
                >
                  No dataset
                </button>
                {datasets.map((ds) => (
                  <button
                    key={ds.id}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted/50 transition-colors"
                    onClick={() => onDatasetChange(ds.id)}
                  >
                    {ds.name} ({ds.rowCount})
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showHistory ? 'secondary' : 'ghost'}
                size="icon"
                className="size-8 shrink-0"
                onClick={onToggleHistory}
                aria-label="Toggle history"
              >
                <Clock className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Test history</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={onClearMatrix}
                disabled={!matrixHasCells}
                aria-label="Clear grid"
              >
                <Trash2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear all</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <TemplateVariablesSection template={template} />
    </div>
  );
}
