import CopyButton from './CopyButton';
import ReasoningBlock from './ReasoningBlock';
import { ToolCallBlock } from './ToolCallBlock';

import LLMResponseBlock from '@/components/editor/LLMResponseBlock';
import type { StreamSegment } from '@/hooks/usePlaygroundStreaming';

interface SegmentTimelineProps {
  segments: StreamSegment[];
  isStreaming: boolean;
  copiedIndex: number | null;
  handleCopy: (text: string, index: number) => Promise<void>;
  /** Offset added to copy index to avoid collisions between instances */
  copyIndexOffset?: number;
  /** Custom wrapper class for response blocks */
  responseClassName?: string;
}

export function SegmentTimeline({
  segments,
  isStreaming,
  copiedIndex,
  handleCopy,
  copyIndexOffset = 0,
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
              <div key={`seg-${idx}`} className="relative group">
                <div className={responseClassName}>
                  <LLMResponseBlock output={seg.text} isStreaming={isStreaming} />
                </div>
                {!isStreaming && seg.text && (
                  <CopyButton
                    text={seg.text}
                    index={copyIndexOffset + idx}
                    copiedIndex={copiedIndex}
                    onCopy={handleCopy}
                  />
                )}
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
