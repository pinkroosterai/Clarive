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

  // Render each message individually, matching the streaming view's layout
  const elements: React.ReactNode[] = [];

  for (let idx = 0; idx < messages.length; idx++) {
    const msg = messages[idx];

    switch (msg.role) {
      case 'system':
        // Skip system messages — they're part of the prompt visible in the template section
        break;

      case 'user':
        elements.push(<CollapsedPrompt key={idx} msg={msg} />);
        break;

      case 'tool_call': {
        const result = msg.callId ? toolResults.get(msg.callId) : undefined;
        elements.push(
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
        break;
      }

      case 'tool_result':
        // Rendered as part of tool_call above
        break;

      case 'assistant':
        elements.push(
          <div key={idx}>
            {msg.reasoning && (
              <ReasoningBlock reasoning={msg.reasoning} isStreaming={isStreaming} />
            )}
            {msg.content ? (
              <div className="relative group rounded-lg border border-border-subtle bg-surface p-4">
                <LLMResponseBlock output={msg.content} isStreaming={isStreaming} />
              </div>
            ) : null}
          </div>
        );
        break;
    }
  }

  return <div className="space-y-2">{elements}</div>;
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
