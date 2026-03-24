import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { StartAbTestRequest } from '@/services/api/abTestService';
import { getEntriesList, getVersionHistory } from '@/services/api/entryService';
import { getEnrichedModels } from '@/services/api/playgroundService';
import { getDatasets } from '@/services/api/testDatasetService';

interface ABTestSetupProps {
  entryId?: string;
  onStartTest: (entryId: string, request: StartAbTestRequest) => void;
  isRunning: boolean;
}

export default function ABTestSetup({
  entryId: initialEntryId,
  onStartTest,
  isRunning,
}: ABTestSetupProps) {
  const [search, setSearch] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState(initialEntryId ?? '');
  const [versionA, setVersionA] = useState('');
  const [versionB, setVersionB] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(4096);

  // Entry search
  const { data: entries } = useQuery({
    queryKey: ['entries', 'list', search],
    queryFn: () => getEntriesList(null, 1, 20, undefined, undefined, search || undefined),
    enabled: !initialEntryId,
  });

  // Versions for selected entry
  const { data: versions = [] } = useQuery({
    queryKey: ['versions', selectedEntryId],
    queryFn: () => getVersionHistory(selectedEntryId),
    enabled: !!selectedEntryId,
  });

  // Datasets for selected entry
  const { data: datasets = [] } = useQuery({
    queryKey: ['datasets', selectedEntryId],
    queryFn: () => getDatasets(selectedEntryId),
    enabled: !!selectedEntryId,
  });

  // Models
  const { data: models = [] } = useQuery({
    queryKey: ['playground', 'enriched-models'],
    queryFn: getEnrichedModels,
    staleTime: 5 * 60 * 1000,
  });

  const canRun =
    selectedEntryId && versionA && versionB && versionA !== versionB && datasetId && model;

  function handleRun() {
    if (!canRun) return;
    onStartTest(selectedEntryId, {
      versionANumber: parseInt(versionA, 10),
      versionBNumber: parseInt(versionB, 10),
      datasetId,
      model,
      temperature,
      maxTokens,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">New A/B Test</h2>
        <p className="text-sm text-muted-foreground">
          Compare two prompt versions against the same inputs to find which performs better.
        </p>
      </div>

      {/* Entry Selection */}
      {!initialEntryId && (
        <div className="space-y-2">
          <Label>Entry</Label>
          <Input
            placeholder="Search entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {entries && entries.items.length > 0 && (
            <Select value={selectedEntryId} onValueChange={setSelectedEntryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an entry" />
              </SelectTrigger>
              <SelectContent>
                {entries.items.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Version Selection */}
      {selectedEntryId && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Version A</Label>
            <Select value={versionA} onValueChange={setVersionA}>
              <SelectTrigger>
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>
                    v{v.version} ({v.versionState})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Version B</Label>
            <Select value={versionB} onValueChange={setVersionB}>
              <SelectTrigger>
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>
                    v{v.version} ({v.versionState})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {versionA && versionB && versionA === versionB && (
        <p className="text-sm text-destructive">Please select two different versions.</p>
      )}

      {/* Dataset Selection */}
      {selectedEntryId && (
        <div className="space-y-2">
          <Label>Test Dataset</Label>
          {datasets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No datasets found. Create one in the entry editor&apos;s Data tab.
            </p>
          ) : (
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger>
                <SelectValue placeholder="Select dataset" />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} ({d.rowCount} rows)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Model & Parameters */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.modelId} value={m.modelId}>
                  {m.displayName ?? m.modelId} ({m.providerName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Temperature: {temperature.toFixed(1)}</Label>
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Tokens</Label>
            <Input
              type="number"
              min={1}
              max={128000}
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 4096)}
            />
          </div>
        </div>
      </div>

      <Button onClick={handleRun} disabled={!canRun || isRunning} className="w-full" size="lg">
        <FlaskConical className="mr-2 size-4" />
        {isRunning ? 'Running...' : 'Run A/B Test'}
      </Button>
    </div>
  );
}
