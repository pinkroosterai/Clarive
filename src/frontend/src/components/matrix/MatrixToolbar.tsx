import { ArrowLeft, ChevronsUpDown, Clock, Database, Play, Plus, Square, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { EnrichedModel } from '@/services/api/playgroundService';
import type { MatrixModel, MatrixVersion } from '@/types/matrix';
import { enrichedModelToMatrixModel } from '@/types/matrix';
import type { TestDataset } from '@/services/api/testDatasetService';
import type { VersionInfo, TabInfo } from '@/types';

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
}: MatrixToolbarProps) {
  const navigate = useNavigate();
  const providerGroups = useMemo(() => groupModelsByProvider(models), [models]);
  const [versionSelectKey, setVersionSelectKey] = useState(0);
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

  // Build version options: tabs first, then published, then historical
  const versionOptions: { id: string; label: string; group: string }[] = [];
  for (const tab of tabs) {
    versionOptions.push({ id: tab.id, label: tab.name, group: 'Tabs' });
  }
  for (const v of versions) {
    if (v.versionState === 'published') {
      versionOptions.push({ id: v.id, label: `Published (v${v.version})`, group: 'Published' });
    }
  }
  for (const v of versions) {
    if (v.versionState === 'historical') {
      versionOptions.push({ id: v.id, label: `v${v.version} (historical)`, group: 'History' });
    }
  }

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

        <Select key={versionSelectKey} onValueChange={(id) => { handleAddVersion(id); setVersionSelectKey((k) => k + 1); }}>
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-1.5">
              <Plus className="size-3.5" />
              <SelectValue placeholder="Add Version" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {['Tabs', 'Published', 'History'].map((group) => {
              const items = versionOptions.filter((v) => v.group === group);
              if (items.length === 0) return null;
              return (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>

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
                <CommandEmpty>No models found.</CommandEmpty>
                {Array.from(providerGroups.entries()).map(([provider, providerModels]) => (
                  <CommandGroup key={provider} heading={provider}>
                    {providerModels.map((m) => (
                      <CommandItem
                        key={m.modelId}
                        value={`${provider} ${m.displayName ?? m.modelId}`}
                        onSelect={() => {
                          handleAddModel(m.modelId);
                          setModelPickerOpen(false);
                        }}
                      >
                        {m.displayName ?? m.modelId}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
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

        {/* Secondary zone: dataset, history, clear */}
        <div className="flex items-center gap-1">
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
