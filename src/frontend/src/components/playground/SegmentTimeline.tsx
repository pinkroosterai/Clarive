import ReasoningBlock from './ReasoningBlock';
import { ToolCallBlock } from './ToolCallBlock';

import LLMResponseBlock from '@/components/editor/LLMResponseBlock';
import type { StreamSegment } from '@/hooks/usePlaygroundStreaming';

interface SegmentTimelineProps {
  segments: StreamSegment[];
  isStreaming: boolean;
  /** Custom wrapper class for response blocks */
  responseClassName?: string;
}

export function SegmentTimeline({
  segments,
  isStreaming,
  responseClassName = 'rounded-lg border border-border-subtle bg-surface p-4',
}: SegmentTimelineProps) {
  return (
    <>
      {segments.map((seg, idx) => {
        switch (seg.type) {
          case 'reasoning':
            return (
              <ReasoningBlock key={`seg-${idx}`} reasoning={seg.text} isStreaming={isStreaming} />
            );
          case 'tool_call': {
            const result = segments.find(
              (s) => s.type === 'tool_result' && s.callId === seg.callId
            );
            const toolResult = result?.type === 'tool_result' ? result : undefined;
            return (
              <ToolCallBlock
                key={`seg-${idx}`}
                toolName={seg.toolName}
                arguments={seg.arguments ?? null}
                response={toolResult?.response ?? null}
                durationMs={toolResult?.durationMs ?? null}
                error={toolResult?.error ?? null}
                status={toolResult ? (toolResult.error ? 'error' : 'complete') : 'calling'}
              />
            );
          }
          case 'tool_result':
            return null; // Rendered as part of tool_call above
          case 'response':
            return (
              <div key={`seg-${idx}`} className={responseClassName}>
                <LLMResponseBlock output={seg.text} isStreaming={isStreaming} />
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
