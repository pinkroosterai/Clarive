import { Loader2 } from 'lucide-react';
import type { RefObject } from 'react';

import { getStreamingStatusMessage } from '@/hooks/usePlaygroundStreaming';

interface StreamingIndicatorProps {
  responseAreaRef: RefObject<HTMLDivElement | null>;
  firstTokenReceived: boolean;
  elapsedSeconds: number;
  approxOutputTokens: number;
}

export function StreamingIndicator({
  responseAreaRef,
  firstTokenReceived,
  elapsedSeconds,
  approxOutputTokens,
}: StreamingIndicatorProps) {
  return (
    <div
      ref={responseAreaRef}
      className="flex items-center gap-2 text-sm text-foreground-muted mb-4"
      aria-live="polite"
      role="status"
    >
      {firstTokenReceived ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>
            {getStreamingStatusMessage(elapsedSeconds)}{' '}
            {elapsedSeconds > 0 && `${elapsedSeconds}s`}
            {approxOutputTokens > 0 && (
              <span className="text-foreground-muted/70 ml-1">
                · ~{approxOutputTokens.toLocaleString()} tokens
              </span>
            )}
          </span>
        </>
      ) : (
        <span className="flex items-center gap-1">
          Connecting{elapsedSeconds > 0 && ` ${elapsedSeconds}s`}
          <span className="inline-flex gap-0.5">
            <span className="size-1 rounded-full bg-foreground-muted animate-pulse" />
            <span className="size-1 rounded-full bg-foreground-muted animate-pulse [animation-delay:200ms]" />
            <span className="size-1 rounded-full bg-foreground-muted animate-pulse [animation-delay:400ms]" />
          </span>
        </span>
      )}
    </div>
  );
}
