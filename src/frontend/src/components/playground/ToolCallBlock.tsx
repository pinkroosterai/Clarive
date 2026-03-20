import { CheckCircle2, Loader2, AlertCircle, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { useState } from 'react';

interface ToolCallBlockProps {
  toolName: string;
  arguments: string | null;
  response: string | null;
  durationMs: number | null;
  error: string | null;
  status: 'calling' | 'complete' | 'error';
}

/** Extract a human-readable preview from tool arguments JSON */
function getArgPreview(toolName: string, args: string | null): string | null {
  if (!args) return null;
  try {
    const parsed = JSON.parse(args);
    // Known tool patterns
    if (parsed.libraryName) return parsed.libraryName;
    if (parsed.query) return parsed.query.length > 60 ? parsed.query.slice(0, 57) + '...' : parsed.query;
    if (parsed.url) return parsed.url.length > 60 ? parsed.url.slice(0, 57) + '...' : parsed.url;
    // Fallback: first string value
    for (const val of Object.values(parsed)) {
      if (typeof val === 'string' && val.length > 0) {
        return val.length > 60 ? val.slice(0, 57) + '...' : val;
      }
    }
  } catch { /* ignore parse errors */ }
  return null;
}

export function ToolCallBlock({
  toolName,
  arguments: args,
  response,
  durationMs,
  error,
  status,
}: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const preview = getArgPreview(toolName, args);

  return (
    <div
      className={`rounded-lg border text-sm ${
        status === 'error'
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-border-subtle bg-elevated/50'
      }`}
    >
      <button
        type="button"
        onClick={() => status !== 'calling' && setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left"
        disabled={status === 'calling'}
      >
        <Wrench className="size-3.5 text-foreground-muted shrink-0" />
        <span className="font-medium text-xs shrink-0">{toolName}</span>
        {preview && (
          <>
            <span className="text-foreground-muted/50 text-xs shrink-0">&rarr;</span>
            <span className="text-xs text-foreground-muted truncate min-w-0">
              {preview}
            </span>
          </>
        )}
        {status === 'calling' && <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />}
        {status === 'complete' && (
          <>
            <CheckCircle2 className="size-3.5 text-success-text shrink-0" />
            {durationMs != null && (
              <span className="text-[10px] text-foreground-muted shrink-0">
                {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </>
        )}
        {status === 'error' && <AlertCircle className="size-3.5 text-destructive shrink-0" />}
        {status !== 'calling' && (
          <span className="ml-auto shrink-0">
            {expanded ? (
              <ChevronDown className="size-3.5 text-foreground-muted" />
            ) : (
              <ChevronRight className="size-3.5 text-foreground-muted" />
            )}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border-subtle pt-2">
          {args && (
            <div>
              <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider mb-1">
                Arguments
              </p>
              <pre className="text-xs font-mono bg-background rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {formatJson(args)}
              </pre>
            </div>
          )}
          {error && (
            <div>
              <p className="text-[10px] font-medium text-destructive uppercase tracking-wider mb-1">
                Error
              </p>
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          {response && (
            <div>
              <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider mb-1">
                Response
              </p>
              <pre className="text-xs font-mono bg-background rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {response.length > 2000 ? response.slice(0, 2000) + '\n...(truncated)' : response}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
