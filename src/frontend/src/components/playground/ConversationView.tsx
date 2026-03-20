import { memo, useState } from 'react';

import ReasoningBlock from './ReasoningBlock';
import { ToolCallBlock } from './ToolCallBlock';

import LLMResponseBlock from '@/components/editor/LLMResponseBlock';
import type { ConversationMessage } from '@/services/api/playgroundService';

export type { ConversationMessage };

interface ConversationViewProps {
  messages: ConversationMessage[];
  isStreaming?: boolean;
}

export const ConversationView = memo(function ConversationView({
  messages,
  isStreaming = false,
}: ConversationViewProps) {
  if (messages.length === 0) return null;

  // Build a map of tool results by callId for pairing with tool_call
  const toolResults = new Map<
    string,
    { response: string | null; error: string | null; durationMs: number | null }
  >();
  for (const msg of messages) {
    if (msg.role === 'tool_result' && msg.callId) {
      toolResults.set(msg.callId, {
        response: msg.content || null,
        error: msg.error || null,
        durationMs: msg.durationMs ?? null,
      });
    }
  }

  // Check if there are tool calls in this conversation
  const hasToolCalls = messages.some((m) => m.role === 'tool_call');

  // Group consecutive tool_call + tool_result messages
  const elements: React.ReactNode[] = [];
  let toolGroup: React.ReactNode[] = [];
  let inToolGroup = false;

  const flushToolGroup = () => {
    if (toolGroup.length > 0) {
      elements.push(
        <div
          key={`tool-group-${elements.length}`}
          className="bg-elevated/20 border-l-2 border-l-accent rounded-r-md py-2 px-3 space-y-1"
        >
          <div className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider mb-1">
            Tool Activity
          </div>
          {toolGroup}
        </div>
      );
      toolGroup = [];
    }
    inToolGroup = false;
  };

  for (let idx = 0; idx < messages.length; idx++) {
    const msg = messages[idx];

    if (msg.role === 'tool_call' || msg.role === 'tool_result') {
      inToolGroup = true;
      if (msg.role === 'tool_call') {
        const result = msg.callId ? toolResults.get(msg.callId) : undefined;
        toolGroup.push(
          <ToolCallBlock
            key={`tool-${msg.callId ?? idx}`}
            toolName={msg.toolName ?? 'Unknown'}
            arguments={msg.arguments ?? null}
            response={result?.response ?? null}
            durationMs={result?.durationMs ?? null}
            error={result?.error ?? null}
            status={result ? (result.error ? 'error' : 'complete') : 'calling'}
          />
        );
      }
      // tool_result is rendered as part of tool_call above
      continue;
    }

    // Flush any pending tool group before rendering a non-tool message
    if (inToolGroup) flushToolGroup();

    switch (msg.role) {
      case 'system':
        // Skip system messages — they're part of the prompt visible in the template section
        break;

      case 'user':
        elements.push(<CollapsedPrompt key={idx} msg={msg} />);
        break;

      case 'assistant':
        elements.push(
          <div key={idx}>
            {msg.reasoning && (
              <ReasoningBlock reasoning={msg.reasoning} isStreaming={isStreaming} />
            )}
            <div className="relative group rounded-lg border border-border-subtle bg-surface p-4">
              {msg.content ? (
                <LLMResponseBlock output={msg.content} isStreaming={isStreaming} />
              ) : (
                <span className="text-xs text-foreground-muted">—</span>
              )}
            </div>
          </div>
        );
        break;
    }
  }

  // Flush any remaining tool group
  if (inToolGroup) flushToolGroup();

  return <div className="space-y-3">{elements}</div>;
});

function CollapsedPrompt({ msg }: { msg: ConversationMessage }) {
  const [expanded, setExpanded] = useState(false);
  const preview = msg.content.slice(0, 100).replace(/\n/g, ' ');
  const isLong = msg.content.length > 120;

  return (
    <div className="bg-elevated/30 rounded-md border border-border-subtle">
      <button
        type="button"
        onClick={() => isLong && setExpanded(!expanded)}
        className="flex items-start gap-2 w-full px-3 py-2 text-left"
      >
        <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider shrink-0 mt-0.5">
          Prompt {(msg.promptIndex ?? 0) + 1}
        </span>
        <span className="text-xs text-foreground-muted truncate flex-1">
          {expanded ? '' : `${preview}${isLong ? '…' : ''}`}
        </span>
        {isLong && (
          <span className="text-[10px] text-primary shrink-0">
            {expanded ? 'Collapse' : 'Show full'}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2">
          <div className="text-xs font-mono whitespace-pre-wrap text-foreground-muted max-h-48 overflow-y-auto">
            {msg.content}
          </div>
        </div>
      )}
    </div>
  );
}
