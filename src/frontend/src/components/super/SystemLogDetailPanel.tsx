import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import type { SystemLogEntry } from '@/services/api/systemLogService';

const levelBadgeClass: Record<string, string> = {
  Verbose: 'bg-muted text-foreground-muted',
  Debug: 'bg-muted text-foreground-muted',
  Information: 'bg-primary/10 text-primary',
  Warning: 'bg-warning-bg text-warning-text border-warning-border',
  Error: 'bg-error-bg text-error-text border-error-border',
  Fatal: 'bg-error-bg text-error-text border-error-border font-bold',
};

interface SystemLogDetailPanelProps {
  row: SystemLogEntry;
  onClose: () => void;
}

export default function SystemLogDetailPanel({ row, onClose }: SystemLogDetailPanelProps) {
  const parsedProperties = useMemo(() => {
    if (!row.properties) return null;
    try {
      return JSON.parse(row.properties) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [row.properties]);

  // Filter out SourceContext from properties (already shown separately)
  const displayProperties = useMemo(() => {
    if (!parsedProperties) return null;
    const entries = Object.entries(parsedProperties).filter(([key]) => key !== 'SourceContext');
    return entries.length > 0 ? entries : null;
  }, [parsedProperties]);

  return (
    <div className="rounded-lg border bg-background-surface p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
        >
          <ChevronDown className="size-4" />
          Log Entry Details
        </button>
        <Badge className={levelBadgeClass[row.level] ?? 'bg-muted text-foreground-muted'}>
          {row.level}
        </Badge>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Timestamp</div>
          <div>{format(new Date(row.timestamp), 'MMM d, yyyy HH:mm:ss.SSS')}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Level</div>
          <div>{row.level}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">Source</div>
          <div className="font-mono text-xs break-all">{row.sourceContext ?? '—'}</div>
        </div>
        <div>
          <div className="text-foreground-muted text-xs mb-0.5">ID</div>
          <div className="font-mono text-xs">{row.id}</div>
        </div>
      </div>

      {/* Full message */}
      <div>
        <div className="text-foreground-muted text-xs mb-1">Message</div>
        <div className="text-sm bg-muted/50 rounded-md p-2.5 break-words">{row.message}</div>
      </div>

      {/* Exception stack trace */}
      {row.exception && (
        <div>
          <div className="text-foreground-muted text-xs mb-1">Exception</div>
          <pre className="text-xs bg-error-bg/30 text-error-text rounded-md p-2.5 overflow-x-auto whitespace-pre-wrap break-words font-mono max-h-[300px] overflow-y-auto scrollbar-themed">
            {row.exception}
          </pre>
        </div>
      )}

      {/* Structured properties */}
      {displayProperties && (
        <div>
          <div className="text-foreground-muted text-xs mb-1">Properties</div>
          <div className="bg-muted/50 rounded-md p-2.5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              {displayProperties.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-medium text-foreground-muted">{key}</dt>
                  <dd className="font-mono break-all">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
