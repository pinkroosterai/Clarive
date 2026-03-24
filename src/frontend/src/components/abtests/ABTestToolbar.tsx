import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { StartAbTestRequest } from '@/services/api/abTestService';
import { getVersionHistory } from '@/services/api/entryService';
import { getEnrichedModels } from '@/services/api/playgroundService';
import type { EnrichedModel } from '@/services/api/playgroundService';
import { getDatasets } from '@/services/api/testDatasetService';

interface ABTestToolbarProps {
  entryId: string;
  entryTitle: string;
  onRun: (request: StartAbTestRequest) => void;
  isRunning: boolean;
  onManageDatasets: () => void;
}

function getVersionLabel(v: { version: number; versionState: string; variantName?: string | null }) {
  if (v.versionState === 'variant') return v.variantName ?? 'Variant';
  if (v.versionState === 'draft') return `v${v.version} (draft)`;
  if (v.versionState === 'published') return `v${v.version} (published)`;
  return `v${v.version}`;
}

export default function ABTestToolbar({
  entryId,
  entryTitle,
  onRun,
  isRunning,
  onManageDatasets,
}: ABTestToolbarProps) {
  const navigate = useNavigate();

  const [versionA, setVersionA] = useState('');
  const [versionB, setVersionB] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [reasoningEffort, setReasoningEffort] = useState('medium');
  const [datasetId, setDatasetId] = useState('');

  const { data: versions = [] } = useQuery({
    queryKey: ['versions', entryId],
    queryFn: () => getVersionHistory(entryId),
  });

  const { data: enrichedModels = [] } = useQuery({
    queryKey: ['playground', 'enriched-models'],
    queryFn: getEnrichedModels,
    staleTime: 5 * 60 * 1000,
  });

  const { data: datasets = [] } = useQuery({
    queryKey: ['datasets', entryId],
    queryFn: () => getDatasets(entryId),
  });

  // Group versions into Active (published, draft, variants) and History (historical)
  const { activeVersions, historyVersions } = useMemo(() => {
    const active = versions.filter(
      (v) => v.versionState === 'published' || v.versionState === 'draft' || v.versionState === 'variant'
    );
    const history = versions.filter((v) => v.versionState === 'historical');
    return { activeVersions: active, historyVersions: history };
  }, [versions]);

  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, EnrichedModel[]> = {};
    for (const m of enrichedModels) {
      const provider = m.providerName || 'Other';
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(m);
    }
    return grouped;
  }, [enrichedModels]);

  const selectedModel = useMemo(
    () => enrichedModels.find((m) => m.modelId === model),
    [enrichedModels, model]
  );

  const canRun = versionA && versionB && versionA !== versionB && datasetId && model && !isRunning;

  function handleRun() {
    if (!canRun) return;
    onRun({
      versionAId: versionA,
      versionBId: versionB,
      datasetId,
      model,
      temperature: selectedModel?.isReasoning ? 1.0 : temperature,
      maxTokens,
      reasoningEffort: selectedModel?.isReasoning ? reasoningEffort : undefined,
    });
  }

  function handleModelChange(modelId: string) {
    setModel(modelId);
    const found = enrichedModels.find((m) => m.modelId === modelId);
    if (found) {
      setTemperature(found.defaultTemperature ?? 1.0);
      setMaxTokens(found.defaultMaxTokens ?? 4096);
      setReasoningEffort(found.defaultReasoningEffort ?? 'medium');
    }
  }

  const VersionSelector = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-32 h-8 text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {activeVersions.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-foreground-muted px-2">Active</SelectLabel>
            {activeVersions.map((v) => (
              <SelectItem key={v.id} value={v.id} className="text-xs">
                {getVersionLabel(v)}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {historyVersions.length > 0 && (
          <SelectGroup>
            <SelectLabel className="text-xs font-semibold text-foreground-muted px-2">History</SelectLabel>
            {historyVersions.map((v) => (
              <SelectItem key={v.id} value={v.id} className="text-xs">
                {getVersionLabel(v)}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );

  return (
    <div className="shrink-0 z-10 bg-surface">
      {/* Main toolbar */}
      <div className="flex items-center gap-2 sm:gap-4 border-b border-border-subtle px-3 sm:px-6 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/entry/${entryId}`)}
          className="gap-1.5 shrink-0"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <Separator orientation="vertical" className="h-5 hidden sm:block" />
        <span className="text-sm font-medium truncate max-w-[6rem] sm:max-w-xs">{entryTitle}</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Version selectors */}
          <VersionSelector value={versionA} onChange={setVersionA} placeholder="Version A" />
          <span className="text-xs text-muted-foreground">vs</span>
          <VersionSelector value={versionB} onChange={setVersionB} placeholder="Version B" />

          <Separator orientation="vertical" className="h-5 hidden sm:block" />

          {/* Model selector */}
          <Select value={model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-36 sm:w-44 h-8 text-xs">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(modelsByProvider).map(([provider, models]) => (
                <SelectGroup key={provider}>
                  <SelectLabel className="text-xs font-semibold text-foreground-muted px-2">
                    {provider}
                  </SelectLabel>
                  {models.map((m) => (
                    <SelectItem key={m.modelId} value={m.modelId} className="text-xs">
                      {m.displayName || m.modelId}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" className="gap-1.5 shrink-0" disabled={!canRun} onClick={handleRun}>
            <FlaskConical className="size-3.5" />
            {isRunning ? 'Running...' : 'Run'}
          </Button>
        </div>
      </div>

      {/* Secondary toolbar — parameters + dataset */}
      <div
        className={`flex flex-wrap items-center gap-3 border-b border-border-subtle px-3 sm:px-6 py-2 ${isRunning ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* Temperature (hidden for reasoning models) */}
        {!selectedModel?.isReasoning && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-foreground-muted shrink-0">Temp</Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[temperature]}
                onValueChange={([v]) => setTemperature(v)}
                min={0}
                max={2}
                step={0.1}
                className="w-24"
              />
              <span className="text-xs text-foreground-muted w-7 tabular-nums">
                {temperature.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* Reasoning controls (shown for reasoning models) */}
        {selectedModel?.isReasoning && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-foreground-muted shrink-0">Reasoning</Label>
            <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low" className="text-xs">Low</SelectItem>
                <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                <SelectItem value="high" className="text-xs">High</SelectItem>
                <SelectItem value="extra-high" className="text-xs">Extra High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Max tokens */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-foreground-muted shrink-0">Tokens</Label>
          <Input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 4096)}
            className="w-20 h-8 text-xs"
            min={1}
            max={128000}
          />
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* Dataset selector */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-foreground-muted shrink-0">Dataset</Label>
          {datasets.length === 0 ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onManageDatasets}>
              + Create Dataset
            </Button>
          ) : (
            <>
              <Select value={datasetId} onValueChange={setDatasetId}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  {datasets.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.name} ({d.rowCount} rows)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onManageDatasets}>
                Manage
              </Button>
            </>
          )}
        </div>

        {versionA && versionB && versionA === versionB && (
          <span className="text-xs text-destructive">Select different versions</span>
        )}
      </div>
    </div>
  );
}
