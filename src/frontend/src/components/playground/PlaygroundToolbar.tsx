import { ArrowLeft, Play, Square, History } from 'lucide-react';
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
import { PLAYGROUND_DEFAULTS } from '@/lib/constants';
import type { EnrichedModel } from '@/services/api/playgroundService';

interface PlaygroundToolbarProps {
  entryId: string | undefined;
  entryTitle: string;
  isChain: boolean;
  promptsCount: number;
  selectedModel: EnrichedModel | null;
  model: string;
  modelsByProvider: Record<string, EnrichedModel[]>;
  modelsError: boolean;
  enrichedModels: EnrichedModel[];
  temperature: number;
  setTemperature: (v: number) => void;
  maxTokens: number;
  setMaxTokens: (v: number) => void;
  reasoningEffort: string;
  setReasoningEffort: (v: string) => void;
  showReasoning: boolean;
  setShowReasoning: (v: boolean) => void;
  isStreaming: boolean;
  showHistory: boolean;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
  hasValidationErrors: boolean;
  handleRun: () => void;
  handleAbort: () => void;
  onModelChange: (model: EnrichedModel) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Ctrl';

export default function PlaygroundToolbar({
  entryId,
  entryTitle,
  isChain,
  promptsCount,
  selectedModel,
  model,
  modelsByProvider,
  modelsError,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  reasoningEffort,
  setReasoningEffort,
  showReasoning,
  setShowReasoning,
  isStreaming,
  showHistory,
  setShowHistory,
  hasValidationErrors,
  handleRun,
  handleAbort,
  onModelChange,
}: PlaygroundToolbarProps) {
  const navigate = useNavigate();

  return (
    <div className="border-b border-border-subtle bg-surface px-6 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Back + title */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/entry/${entryId}`)}
          className="gap-1.5 shrink-0"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <span className="text-sm font-medium truncate max-w-xs">{entryTitle}</span>
        {isChain && <span className="text-xs text-foreground-muted">{promptsCount} prompts</span>}

        <div className="flex-1" />

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Parameter controls (locked during streaming) */}
          <div
            className={`flex items-center gap-3 flex-wrap transition-opacity ${isStreaming ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {/* Model */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-foreground-muted shrink-0">Model</Label>
              {modelsError ? (
                <span className="text-xs text-destructive">Failed to load models</span>
              ) : (
                <Select
                  value={model}
                  onValueChange={(v) => {
                    const found = Object.values(modelsByProvider)
                      .flat()
                      .find((m) => m.modelId === v);
                    if (found) onModelChange(found);
                  }}
                >
                  <SelectTrigger className="w-52 h-8 text-xs">
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
              )}
            </div>

            {/* Temperature (hidden for reasoning models) */}
            {!selectedModel?.isReasoning && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-foreground-muted shrink-0">Temp</Label>
                <Slider
                  value={[temperature]}
                  onValueChange={([v]) => setTemperature(v)}
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-20"
                />
                <span className="text-xs text-foreground-muted w-7 tabular-nums">
                  {temperature.toFixed(1)}
                </span>
              </div>
            )}

            {/* Reasoning controls (shown for reasoning models) */}
            {selectedModel?.isReasoning && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-foreground-muted shrink-0">Reasoning</Label>
                  <Select value={reasoningEffort} onValueChange={setReasoningEffort}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low" className="text-xs">
                        Low
                      </SelectItem>
                      <SelectItem value="medium" className="text-xs">
                        Medium
                      </SelectItem>
                      <SelectItem value="high" className="text-xs">
                        High
                      </SelectItem>
                      <SelectItem value="extra-high" className="text-xs">
                        Extra High
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-foreground-muted">Show thinking</Label>
                  <input
                    type="checkbox"
                    checked={showReasoning}
                    onChange={(e) => setShowReasoning(e.target.checked)}
                    className="size-3.5 rounded"
                  />
                </div>
              </>
            )}

            {/* Max tokens */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-foreground-muted shrink-0">Tokens</Label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) =>
                  setMaxTokens(
                    Math.max(1, Math.min(Number(e.target.value) || PLAYGROUND_DEFAULTS.MAX_TOKENS, 128000))
                  )
                }
                onBlur={(e) => {
                  if (!e.target.value || Number(e.target.value) < 1)
                    setMaxTokens(PLAYGROUND_DEFAULTS.MAX_TOKENS);
                }}
                className="w-20 h-8 text-xs"
                min={1}
              />
            </div>
          </div>

          {/* History toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((p) => !p)}
            className={showHistory ? 'bg-elevated' : ''}
            title="Test History"
            aria-label="Toggle test history"
          >
            <History className="size-4" />
          </Button>

          {/* Run / Stop */}
          {isStreaming ? (
            <Button size="sm" variant="destructive" onClick={handleAbort} title="Stop (Esc)">
              <Square className="size-3 mr-1.5" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleRun}
              disabled={!model || hasValidationErrors}
              title={hasValidationErrors ? 'Fill all template fields to run' : `Run (${modKey}+Enter)`}
            >
              <Play className="size-3 mr-1.5" />
              Run
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
