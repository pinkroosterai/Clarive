import {
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ArrowDownToLine,
  Loader2,
  Pin,
  PinOff,
  X,
} from 'lucide-react';

import LLMResponseBlock from '@/components/editor/LLMResponseBlock';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { scoreColor } from '@/components/wizard/scoreUtils';
import type {
  TestRunResponse,
  TestRunPromptResponse,
  EnrichedModel,
} from '@/services/api/playgroundService';

interface PlaygroundHistorySidebarProps {
  testRuns: TestRunResponse[];
  isStreaming: boolean;
  selectedModel: EnrichedModel | null;
  elapsedSeconds: number;
  expandedRunId: string | null;
  setExpandedRunId: (id: string | null) => void;
  pinnedRuns: TestRunResponse[];
  onTogglePin: (run: TestRunResponse) => void;
  copiedIndex: number | null;
  handleRerun: (run: TestRunResponse) => void;
  handleCopy: (text: string, index: number) => Promise<void>;
  onClose: () => void;
}

export default function PlaygroundHistorySidebar({
  testRuns,
  isStreaming,
  selectedModel,
  elapsedSeconds,
  expandedRunId,
  setExpandedRunId,
  pinnedRuns,
  onTogglePin,
  copiedIndex,
  handleRerun,
  handleCopy,
  onClose,
}: PlaygroundHistorySidebarProps) {
  return (
    <div className="w-full h-full border-l border-border-subtle bg-surface overflow-hidden flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <Clock className="size-4 text-foreground-muted" />
        <span className="text-sm font-medium">History</span>
        <span className="text-xs text-foreground-muted">({testRuns.length})</span>
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded hover:bg-elevated text-foreground-muted hover:text-foreground transition-colors"
          aria-label="Close history"
        >
          <X className="size-4" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        {isStreaming && (
          <div className="px-4 py-3 border-b border-border-subtle bg-primary/5">
            <div className="flex items-center gap-1.5 text-xs">
              <Loader2 className="size-3 animate-spin text-primary" />
              <span className="font-mono text-foreground-muted">
                {selectedModel?.displayName || selectedModel?.modelId || 'Running...'}
              </span>
            </div>
            <div className="text-xs text-foreground-muted mt-0.5">
              {elapsedSeconds > 0 ? `${elapsedSeconds}s` : 'Starting...'}
            </div>
          </div>
        )}
        {testRuns.length === 0 && !isStreaming ? (
          <p className="text-xs text-foreground-muted p-4 text-center">No test runs yet</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {testRuns.map((run) => {
              const isPinned = pinnedRuns.some((r) => r.id === run.id);
              return (
                <div key={run.id} className={`px-4 py-3 ${isPinned ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <button
                      onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                      className="flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
                    >
                      {expandedRunId === run.id ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                      <span className="font-mono">{run.model}</span>
                      {run.judgeScores && (
                        <span
                          className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-elevated ${scoreColor(run.judgeScores.averageScore).text}`}
                          title={`Quality: ${run.judgeScores.averageScore.toFixed(1)}/10`}
                        >
                          {run.judgeScores.averageScore.toFixed(1)}
                        </span>
                      )}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5"
                      onClick={() => onTogglePin(run)}
                      title={isPinned ? 'Unpin' : 'Pin for comparison'}
                    >
                      {isPinned ? (
                        <PinOff className="size-3 text-primary" />
                      ) : (
                        <Pin className="size-3" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5"
                      onClick={() => handleRerun(run)}
                      title="Load parameters"
                    >
                      <ArrowDownToLine className="size-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-foreground-muted flex items-center gap-2">
                    <span>t={run.temperature.toFixed(1)}</span>
                    <span>max={run.maxTokens}</span>
                  </div>
                  <div className="text-xs text-foreground-muted mt-0.5">
                    {new Date(run.createdAt).toLocaleString()}
                  </div>

                  {expandedRunId === run.id && (
                    <div className="mt-2 space-y-2">
                      {run.responses.map((r: TestRunPromptResponse) => (
                        <div key={r.promptIndex} className="relative group">
                          <div className="bg-elevated rounded-md p-2 border border-border-subtle max-h-40 overflow-y-auto text-xs">
                            <LLMResponseBlock output={r.content} isStreaming={false} />
                          </div>
                          <button
                            onClick={() => handleCopy(r.content, 1000 + r.promptIndex)}
                            className="absolute top-1 right-1 p-1 rounded bg-elevated/80 border border-border-subtle opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {copiedIndex === 1000 + r.promptIndex ? (
                              <Check className="size-3 text-success-text" />
                            ) : (
                              <Copy className="size-3 text-foreground-muted" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
