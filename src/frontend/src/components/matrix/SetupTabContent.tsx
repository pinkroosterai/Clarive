import { ChevronsUpDown, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { MatrixToolsPanel } from '@/components/matrix/MatrixToolsPanel';
import { TemplateVariablesSection } from '@/components/playground/TemplateVariablesSection';
import type { PlaygroundTemplateState } from '@/components/playground/utils';
import { ActionGroup } from '@/components/shared/ActionGroup';
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
import type { EnrichedModel } from '@/services/api/playgroundService';
import type { TestDataset } from '@/services/api/testDatasetService';
import type { MatrixModel, MatrixVersion } from '@/types/matrix';
import { enrichedModelToMatrixModel } from '@/types/matrix';
import type { McpServer, ToolDescription, VersionInfo, TabInfo } from '@/types';

// ── Grouped state interfaces ──

export interface ToolsState {
  mcpServers: McpServer[];
  allTools: ToolDescription[];
  enabledServerIds: string[];
  setEnabledServerIds: (ids: string[]) => void;
  excludedToolNames: string[];
  setExcludedToolNames: (names: string[]) => void;
}

export interface VersionPickerProps {
  versions: VersionInfo[];
  tabs: TabInfo[];
  onAddVersion: (version: MatrixVersion) => void;
  addedVersionIds: Set<string>;
}

export interface ModelPickerProps {
  models: EnrichedModel[];
  onAddModel: (model: MatrixModel) => void;
  addedModelIds: Set<string>;
}

export interface DatasetPickerProps {
  datasets: TestDataset[];
  selectedDatasetId: string | null;
  onDatasetChange: (datasetId: string | null) => void;
}

// ── Component props ──

export interface SetupTabContentProps {
  versionPicker: VersionPickerProps;
  modelPicker: ModelPickerProps;
  template: PlaygroundTemplateState;
  tools: ToolsState;
  dataset: DatasetPickerProps;
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

export function SetupTabContent({
  versionPicker,
  modelPicker,
  template,
  tools,
  dataset,
}: SetupTabContentProps) {
  const { versions, tabs, onAddVersion, addedVersionIds } = versionPicker;
  const { models, onAddModel, addedModelIds } = modelPicker;
  const { mcpServers, allTools, enabledServerIds, setEnabledServerIds, excludedToolNames, setExcludedToolNames } = tools;
  const { datasets, selectedDatasetId, onDatasetChange } = dataset;

  const providerGroups = useMemo(() => groupModelsByProvider(models), [models]);
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const handleAddModel = (modelId: string) => {
    const model = models.find((m) => m.modelId === modelId);
    if (model) onAddModel(enrichedModelToMatrixModel(model));
  };

  const handleAddVersion = (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      onAddVersion({ id: tab.id, label: tab.name, type: 'tab', tabName: tab.name });
      return;
    }
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
    <div className="space-y-4">
      {/* Versions section */}
      <ActionGroup label="Versions">
        <Popover open={versionPickerOpen} onOpenChange={setVersionPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={versionPickerOpen}
              className="w-full justify-between"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="size-3.5" />
                Add Version
              </div>
              <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" side="left" align="start">
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
      </ActionGroup>

      <Separator />

      {/* Models section */}
      <ActionGroup label="Models">
        <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={modelPickerOpen}
              className="w-full justify-between"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="size-3.5" />
                Add Model
              </div>
              <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" side="left" align="start">
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
      </ActionGroup>

      {/* Template variables */}
      {template.templateFields.length > 0 && (
        <>
          <Separator />
          <TemplateVariablesSection template={template} />
        </>
      )}

      {/* Tools */}
      {mcpServers.some((s) => s.isActive) && (
        <>
          <Separator />
          <ActionGroup label="Tools">
            <MatrixToolsPanel
              mcpServers={mcpServers}
              allTools={allTools}
              enabledServerIds={enabledServerIds}
              setEnabledServerIds={setEnabledServerIds}
              excludedToolNames={excludedToolNames}
              setExcludedToolNames={setExcludedToolNames}
            />
          </ActionGroup>
        </>
      )}

      {/* Dataset */}
      {datasets.length > 0 && (
        <>
          <Separator />
          <ActionGroup label="Dataset">
            <div className="space-y-1">
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  !selectedDatasetId ? 'bg-muted/50 font-medium' : 'hover:bg-muted/50'
                }`}
                onClick={() => onDatasetChange(null)}
              >
                No dataset
              </button>
              {datasets.map((ds) => (
                <button
                  key={ds.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    selectedDatasetId === ds.id ? 'bg-muted/50 font-medium' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => onDatasetChange(ds.id)}
                >
                  {ds.name} ({ds.rowCount})
                </button>
              ))}
            </div>
          </ActionGroup>
        </>
      )}
    </div>
  );
}
