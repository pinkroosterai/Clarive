import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Square, ChevronDown, ChevronRight, Clock, Copy, Check, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { parseTemplateTags } from '@/lib/templateParser';
import {
  testEntry,
  getTestRuns,
  getAvailableModels,
  type TestStreamChunk,
  type TestRunResponse,
  type TestRunPromptResponse,
} from '@/services/api/playgroundService';

import type { Prompt, TemplateField } from '@/types';

interface PlaygroundPanelProps {
  entryId: string;
  prompts: Prompt[];
  systemMessage?: string | null;
}

function safeSessionGet<T>(key: string, fallback: T): T {
  try {
    const val = sessionStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

export default function PlaygroundPanel({ entryId, prompts, systemMessage }: PlaygroundPanelProps) {
  const storageKey = `playground_${entryId}`;
  const queryClient = useQueryClient();

  // Model & params
  const [model, setModel] = useState<string>('');
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(4096);

  // Template fields
  const templateFields = useMemo(() => {
    const seen = new Set<string>();
    const fields: TemplateField[] = [];
    for (const p of prompts) {
      for (const f of parseTemplateTags(p.content)) {
        if (!seen.has(f.name)) {
          seen.add(f.name);
          fields.push(f);
        }
      }
    }
    return fields;
  }, [prompts]);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    safeSessionGet(storageKey + '_fields', {})
  );

  // Persist field values
  useEffect(() => {
    if (Object.keys(fieldValues).length > 0) {
      sessionStorage.setItem(storageKey + '_fields', JSON.stringify(fieldValues));
    }
  }, [fieldValues, storageKey]);

  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedResponses, setStreamedResponses] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Elapsed time + tokens
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastTokens, setLastTokens] = useState<{ input: number | null; output: number | null } | null>(null);

  // Response display
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  // Queries
  const { data: models = [], isError: modelsError } = useQuery({
    queryKey: ['playground', 'models'],
    queryFn: getAvailableModels,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: testRuns = [] } = useQuery({
    queryKey: ['playground', 'runs', entryId],
    queryFn: () => getTestRuns(entryId),
    staleTime: 30 * 1000,
  });

  // Set default model when models load
  useEffect(() => {
    if (models.length > 0 && !model) {
      setModel(models[0]);
    }
  }, [models, model]);

  const handleRun = useCallback(async () => {
    setIsStreaming(true);
    setStreamedResponses({});
    setError(null);
    setLastTokens(null);
    setElapsedSeconds(0);
    setExpandedPrompts(new Set());

    // Start elapsed time counter
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await testEntry(
        entryId,
        {
          model: model || undefined,
          temperature,
          maxTokens,
          templateFields: templateFields.length > 0 ? fieldValues : undefined,
        },
        (chunk: TestStreamChunk) => {
          setStreamedResponses((prev) => ({
            ...prev,
            [chunk.promptIndex]: (prev[chunk.promptIndex] || '') + chunk.text,
          }));
        },
        controller.signal
      );

      // Capture token counts from result
      if (result.inputTokens != null || result.outputTokens != null) {
        setLastTokens({ input: result.inputTokens, output: result.outputTokens });
      }

      queryClient.invalidateQueries({ queryKey: ['playground', 'runs', entryId] });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled
      } else {
        setError(err instanceof Error ? err.message : 'Test failed');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Final elapsed update
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }
  }, [entryId, model, temperature, maxTokens, fieldValues, templateFields, queryClient]);

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleCopy = useCallback(async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const handleRerun = useCallback(
    (run: TestRunResponse) => {
      setModel(run.model);
      setTemperature(run.temperature);
      setMaxTokens(run.maxTokens);
      if (run.templateFieldValues) {
        setFieldValues(run.templateFieldValues);
      }
    },
    []
  );

  const hasResponses = Object.keys(streamedResponses).length > 0;

  return (
    <div>
      {/* Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Model selector */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-foreground-muted shrink-0">Model</Label>
            {modelsError ? (
              <span className="text-xs text-destructive">Failed to load models</span>
            ) : (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Temperature */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-foreground-muted shrink-0">Temp</Label>
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

          {/* Max tokens */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-foreground-muted shrink-0">Max tokens</Label>
            <Input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value) || 4096)}
              className="w-20 h-8 text-xs"
              min={1}
              max={32000}
            />
          </div>

          {/* Run / Abort button */}
          {isStreaming ? (
            <Button size="sm" variant="destructive" onClick={handleAbort} className="ml-auto">
              <Square className="size-3 mr-1.5" />
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={handleRun} className="ml-auto">
              <Play className="size-3 mr-1.5" />
              Run
            </Button>
          )}
        </div>

        {/* Template fields */}
        {templateFields.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-foreground-muted">Template Variables</Label>
            <div className="grid grid-cols-2 gap-2">
              {templateFields.map((field) => (
                <div key={field.name} className="flex items-center gap-2">
                  <Label className="text-xs font-mono shrink-0 w-28 truncate" title={field.name}>
                    {`{{${field.name}}}`}
                  </Label>
                  {field.type === 'enum' && field.enumValues.length > 0 ? (
                    <Select
                      value={fieldValues[field.name] || ''}
                      onValueChange={(v) =>
                        setFieldValues((prev) => ({ ...prev, [field.name]: v }))
                      }
                    >
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field.enumValues.map((v) => (
                          <SelectItem key={v} value={v} className="text-xs">
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={fieldValues[field.name] || ''}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                      placeholder={field.type !== 'string' ? field.type : 'value'}
                      className="h-7 text-xs flex-1"
                      type={field.type === 'int' || field.type === 'float' ? 'number' : 'text'}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Response area */}
      {(hasResponses || error || isStreaming) && (
        <div className="pt-3 space-y-3">
          {/* Streaming indicator */}
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-foreground-muted">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Generating... {elapsedSeconds > 0 && `${elapsedSeconds}s`}</span>
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded p-3">{error}</div>
          )}

          {prompts.map((_prompt, i) => {
            const response = streamedResponses[i];
            if (response === undefined && !isStreaming) return null;
            const isExpanded = expandedPrompts.has(i);
            const isLong = (response?.split('\n').length ?? 0) > 20;

            return (
              <div key={i} className="space-y-1">
                {prompts.length > 1 && (
                  <div className="text-xs text-foreground-muted font-medium">
                    Prompt {i + 1} response
                  </div>
                )}
                <div className="relative group">
                  <pre
                    className={`bg-elevated rounded-md p-3 text-sm font-mono whitespace-pre-wrap border border-border-subtle overflow-x-auto ${
                      !isExpanded && isLong ? 'max-h-60 overflow-hidden' : ''
                    }`}
                  >
                    {response || ''}
                  </pre>

                  {/* Copy button */}
                  {response && !isStreaming && (
                    <button
                      onClick={() => handleCopy(response, i)}
                      className="absolute top-2 right-2 p-1 rounded bg-elevated/80 border border-border-subtle opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy response"
                    >
                      {copiedIndex === i ? (
                        <Check className="size-3.5 text-success-text" />
                      ) : (
                        <Copy className="size-3.5 text-foreground-muted" />
                      )}
                    </button>
                  )}

                  {/* Expand/collapse for long responses */}
                  {isLong && !isStreaming && (
                    <button
                      onClick={() =>
                        setExpandedPrompts((prev) => {
                          const next = new Set(prev);
                          next.has(i) ? next.delete(i) : next.add(i);
                          return next;
                        })
                      }
                      className="w-full text-center py-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Token count + elapsed time */}
          {!isStreaming && hasResponses && (
            <div className="flex items-center gap-4 text-xs text-foreground-muted">
              {elapsedSeconds > 0 && <span>{elapsedSeconds}s</span>}
              {lastTokens && (
                <>
                  {lastTokens.input != null && <span>{lastTokens.input} input tokens</span>}
                  {lastTokens.output != null && <span>{lastTokens.output} output tokens</span>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Run History */}
      {testRuns.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 py-2 w-full text-left border-t border-border-subtle hover:bg-elevated/50 transition-colors rounded-md mt-3">
            {historyOpen ? (
              <ChevronDown className="size-3.5 text-foreground-muted" />
            ) : (
              <ChevronRight className="size-3.5 text-foreground-muted" />
            )}
            <Clock className="size-3.5 text-foreground-muted" />
            <span className="text-xs text-foreground-muted">
              History ({testRuns.length})
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border-subtle divide-y divide-border-subtle">
              {testRuns.map((run) => (
                <div key={run.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setExpandedRunId(expandedRunId === run.id ? null : run.id)
                      }
                      className="flex items-center gap-2 text-xs text-foreground-secondary hover:text-foreground transition-colors"
                    >
                      {expandedRunId === run.id ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                      <span className="font-mono">{run.model}</span>
                      <span className="text-foreground-muted">
                        t={run.temperature.toFixed(1)}
                      </span>
                      <span className="text-foreground-muted">
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleRerun(run)}
                      title="Load these parameters"
                    >
                      <RotateCcw className="size-3" />
                    </Button>
                  </div>
                  {expandedRunId === run.id && (
                    <div className="mt-2 space-y-2">
                      {run.responses.map((r: TestRunPromptResponse) => (
                        <pre
                          key={r.promptIndex}
                          className="bg-elevated rounded-md p-3 text-xs font-mono whitespace-pre-wrap border border-border-subtle max-h-60 overflow-y-auto"
                        >
                          {r.content}
                        </pre>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
