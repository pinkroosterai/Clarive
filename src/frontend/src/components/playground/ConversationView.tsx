import { memo } from 'react';

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

  return (
    <div className="space-y-3">
      {messages.map((msg, idx) => {
        switch (msg.role) {
          case 'system':
            return (
              <div
                key={idx}
                className="bg-elevated/50 border-l-2 border-l-primary rounded-r-md p-3"
              >
                <div className="text-[10px] font-semibold text-primary mb-1 uppercase tracking-wider">
                  System
                </div>
                <div className="text-xs font-mono whitespace-pre-wrap text-foreground-muted max-h-32 overflow-y-auto">
                  {msg.content}
                </div>
              </div>
            );

          case 'user':
            return (
              <div key={idx} className="bg-elevated/30 rounded-md p-3 border border-border-subtle">
                {msg.promptIndex !== undefined && msg.promptIndex !== null && (
                  <div className="text-[10px] font-semibold text-foreground-muted mb-1 uppercase tracking-wider">
                    Prompt {msg.promptIndex + 1}
                  </div>
                )}
                <div className="text-xs font-mono whitespace-pre-wrap text-foreground-muted max-h-32 overflow-y-auto">
                  {msg.content}
                </div>
              </div>
            );

          case 'tool_call': {
            const result = msg.callId ? toolResults.get(msg.callId) : undefined;
            return (
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

          case 'tool_result':
            // Rendered as part of tool_call above
            return null;

          case 'assistant':
            return (
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

          default:
            return null;
        }
      })}
    </div>
  );
});
