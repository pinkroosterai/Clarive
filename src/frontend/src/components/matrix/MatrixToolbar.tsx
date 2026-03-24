import { ArrowLeft, Play, Plus, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { TemplateVariablesSection } from '@/components/playground/TemplateVariablesSection';
import type { PlaygroundTemplateState } from '@/components/playground/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Slider } from '@/components/ui/slider';
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
}: MatrixToolbarProps) {
  const navigate = useNavigate();
  const providerGroups = useMemo(() => groupModelsByProvider(models), [models]);
  const [versionSelectKey, setVersionSelectKey] = useState(0);
  const [modelSelectKey, setModelSelectKey] = useState(0);

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
      <div className="flex items-center gap-3">
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

        <Select key={modelSelectKey} onValueChange={(id) => { handleAddModel(id); setModelSelectKey((k) => k + 1); }}>
          <SelectTrigger className="w-[200px]">
            <div className="flex items-center gap-1.5">
              <Plus className="size-3.5" />
              <SelectValue placeholder="Add Model" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {Array.from(providerGroups.entries()).map(([provider, providerModels]) => (
              <SelectGroup key={provider}>
                <SelectLabel>{provider}</SelectLabel>
                {providerModels.map((m) => (
                  <SelectItem key={m.modelId} value={m.modelId}>
                    {m.displayName ?? m.modelId}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {datasets.length > 0 && (
          <Select
            value={selectedDatasetId ?? 'none'}
            onValueChange={(v) => onDatasetChange(v === 'none' ? null : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="No dataset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No dataset</SelectItem>
              {datasets.map((ds) => (
                <SelectItem key={ds.id} value={ds.id}>
                  {ds.name} ({ds.rowCount} rows)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Separator orientation="vertical" className="h-6" />

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
      </div>
      <TemplateVariablesSection template={template} />
    </div>
  );
}
