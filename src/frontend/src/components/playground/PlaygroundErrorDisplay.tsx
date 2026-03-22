import { Button } from '@/components/ui/button';
import { mapPlaygroundError, isRateLimitError } from '@/lib/playgroundErrors';

interface PlaygroundErrorDisplayProps {
  error: string;
  rateLimitCountdown: number;
  isStreaming: boolean;
  onRetry: () => void;
}

export function PlaygroundErrorDisplay({
  error,
  rateLimitCountdown,
  isStreaming,
  onRetry,
}: PlaygroundErrorDisplayProps) {
  return (
    <div
      aria-live="assertive"
      className={`text-sm rounded-lg p-4 mb-4 flex items-center justify-between gap-3 ${
        isRateLimitError(error)
          ? 'text-warning-text bg-warning-bg border border-warning-border'
          : 'text-destructive bg-destructive/10'
      }`}
    >
      <div className="flex-1">
        <span>
          {isRateLimitError(error) && rateLimitCountdown > 0
            ? `Rate limit reached — you can try again in ${rateLimitCountdown}s`
            : mapPlaygroundError(error)}
        </span>
        {isRateLimitError(error) && rateLimitCountdown > 0 && (
          <div className="mt-2 h-1 rounded-full bg-warning-border/30 overflow-hidden">
            <div
              className="h-full bg-warning-text/60 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${((60 - rateLimitCountdown) / 60) * 100}%` }}
            />
          </div>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={isStreaming || rateLimitCountdown > 0}
        className="shrink-0"
      >
        {rateLimitCountdown > 0 ? `Retry in ${rateLimitCountdown}s` : 'Retry'}
      </Button>
    </div>
  );
}
