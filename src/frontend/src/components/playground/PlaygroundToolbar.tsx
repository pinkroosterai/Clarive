import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, ListPlus, Play, Server, Square, History, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { PLAYGROUND_DEFAULTS } from '@/lib/constants';
import { mcpServerService, toolService } from '@/services';

import type { PlaygroundModelState, PlaygroundRunState, PlaygroundToolState } from './utils';

interface PlaygroundToolbarProps {
  entryId: string | undefined;
  entryTitle: string;
  isChain: boolean;
  promptsCount: number;
  modelState: PlaygroundModelState;
  runState: PlaygroundRunState;
  toolState: PlaygroundToolState;
  showHistory: boolean;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Ctrl';

export default function PlaygroundToolbar({
  entryId,
  entryTitle,
  isChain,
  promptsCount,
  modelState,
  runState,
  toolState,
  showHistory,
  setShowHistory,
}: PlaygroundToolbarProps) {
  const {
    selectedModel, model, modelsByProvider, modelsError,
    temperature, setTemperature, maxTokens, setMaxTokens,
    reasoningEffort, setReasoningEffort, showReasoning, setShowReasoning,
    onModelChange,
  } = modelState;
  const {
    isStreaming, hasValidationErrors, handleRun, handleAbort,
    onEnqueue, queueLength, isBatchRunning, batchCurrent, batchTotal,
  } = runState;
  const { enabledServerIds, setEnabledServerIds, excludedToolNames, setExcludedToolNames } = toolState;
  const navigate = useNavigate();

  // ── MCP servers + tools for toolbar ──
  const { data: mcpServers = [] } = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: mcpServerService.list,
  });
  const { data: allTools = [] } = useQuery({
    queryKey: ['tools'],
    queryFn: toolService.getToolsList,
  });
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);

  const toggleServer = (serverId: string) => {
    if (enabledServerIds.includes(serverId)) {
      setEnabledServerIds(enabledServerIds.filter((id) => id !== serverId));
      // Remove excluded tools for this server
      const serverTools = allTools.filter((t) => t.mcpServerName === mcpServers.find((s) => s.id === serverId)?.name);
      const serverToolNames = new Set(serverTools.map((t) => t.toolName));
      setExcludedToolNames(excludedToolNames.filter((n) => !serverToolNames.has(n)));
    } else {
      setEnabledServerIds([...enabledServerIds, serverId]);
    }
  };

  const toggleToolExclusion = (toolName: string) => {
    if (excludedToolNames.includes(toolName)) {
      setExcludedToolNames(excludedToolNames.filter((n) => n !== toolName));
    } else {
      setExcludedToolNames([...excludedToolNames, toolName]);
    }
  };

  // Model selector — shared between desktop inline and mobile popover
  const modelSelector = (
    <div className="flex items-center gap-2">
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
          <SelectTrigger className="w-36 sm:w-44 md:w-52 h-8 text-xs">
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
  );

  // Parameter controls — rendered inline on md+ and inside popover on <md
  const parameterControls = (vertical: boolean) => (
    <div
      className={`${vertical ? 'flex flex-col gap-3' : 'flex items-center gap-3'} ${isStreaming ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Temperature (hidden for reasoning models) */}
      {!selectedModel?.isReasoning && (
        <div className={`flex items-center gap-2 ${vertical ? 'justify-between' : ''}`}>
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
        <>
          <div className={`flex items-center gap-2 ${vertical ? 'justify-between' : ''}`}>
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
          <div className={`flex items-center gap-1.5 ${vertical ? 'justify-between' : ''}`}>
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
      <div className={`flex items-center gap-2 ${vertical ? 'justify-between' : ''}`}>
        <Label className="text-xs text-foreground-muted shrink-0">Tokens</Label>
        <Input
          type="number"
          value={maxTokens}
          onChange={(e) =>
            setMaxTokens(
              Math.max(
                1,
                Math.min(Number(e.target.value) || PLAYGROUND_DEFAULTS.MAX_TOKENS, 128000)
              )
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
  );

  const hasQueue = queueLength > 0;

  return (
    <div className="shrink-0 z-10 border-b border-border-subtle bg-surface px-3 sm:px-6 py-3">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Back + title */}
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
        {isChain && (
          <span className="text-xs text-foreground-muted hidden sm:inline">
            {promptsCount} prompts
          </span>
        )}

        <div className="flex-1 min-w-0" />

        {/* Controls row — always single line */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          {/* Model selector — always visible */}
          <div className={isStreaming ? 'opacity-50 pointer-events-none' : ''}>
            {modelSelector}
          </div>

          {/* Settings popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Model settings"
              >
                <SlidersHorizontal className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="text-xs font-medium text-foreground-muted mb-3">Settings</div>
              {parameterControls(true)}

              {mcpServers.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <div className="text-xs font-medium text-foreground-muted mb-2 flex items-center gap-1.5">
                    <Server className="size-3" />
                    Tools
                  </div>
                  <div className={`space-y-2 ${isStreaming ? 'opacity-50 pointer-events-none' : ''}`}>
                    {mcpServers.map((server) => {
                      const enabled = enabledServerIds.includes(server.id);
                      const expanded = expandedServerId === server.id;
                      const serverTools = allTools.filter((t) => t.mcpServerName === server.name);

                      return (
                        <div key={server.id}>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={enabled}
                              onCheckedChange={() => toggleServer(server.id)}
                              className="scale-75"
                            />
                            <span className="text-xs flex-1 truncate">{server.name}</span>
                            <span className="text-[10px] text-foreground-muted">{server.toolCount}</span>
                            {enabled && serverTools.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedServerId(expanded ? null : server.id)}
                                className="p-0.5 text-foreground-muted hover:text-foreground"
                              >
                                {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                              </button>
                            )}
                          </div>
                          {enabled && expanded && serverTools.length > 0 && (
                            <div className="ml-7 mt-1 space-y-1">
                              {serverTools.map((tool) => (
                                <label key={tool.id} className="flex items-center gap-1.5 cursor-pointer">
                                  <Checkbox
                                    checked={!excludedToolNames.includes(tool.toolName)}
                                    onCheckedChange={() => toggleToolExclusion(tool.toolName)}
                                    className="scale-75"
                                  />
                                  <span className="text-[11px] truncate">{tool.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </PopoverContent>
          </Popover>

          {/* Enqueue */}
          <Button
            size="sm"
            variant="outline"
            onClick={onEnqueue}
            disabled={!model || isStreaming}
            title="Add model + params to comparison queue"
          >
            <ListPlus className="size-3 mr-1.5" />
            <span className="hidden sm:inline">Enqueue</span>
          </Button>

          {/* Run / Stop */}
          {isStreaming ? (
            <>
              <Button size="sm" variant="destructive" onClick={handleAbort} title="Stop (Esc)">
                <Square className="size-3 mr-1.5" />
                Stop
              </Button>
              {isBatchRunning && batchTotal != null && batchTotal > 1 && batchCurrent != null && (
                <span className="text-xs text-foreground-muted tabular-nums">
                  {batchCurrent}/{batchTotal}
                </span>
              )}
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleRun}
              disabled={!model || hasValidationErrors || hasQueue}
              title={
                hasQueue
                  ? 'Clear queue or use Run Queue to run comparison'
                  : hasValidationErrors
                    ? 'Fill all template fields to run'
                    : `Run (${modKey}+Enter)`
              }
            >
              <Play className="size-3 mr-1.5" />
              Run
            </Button>
          )}

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
        </div>
      </div>
    </div>
  );
}
