import { formatTokenCount, formatCost, formatElapsed, resolveTotalCost } from '@/lib/formatters';

interface RunMetadataBarProps {
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedInputCostUsd?: number | null;
  estimatedOutputCostUsd?: number | null;
  estimatedTotalCostUsd?: number | null;
  elapsedMs: number | null;
}

export function RunMetadataBar({
  inputTokens,
  outputTokens,
  estimatedInputCostUsd,
  estimatedOutputCostUsd,
  estimatedTotalCostUsd,
  elapsedMs,
}: RunMetadataBarProps) {
  if (inputTokens == null && outputTokens == null && elapsedMs == null) return null;

  const parts: string[] = [];

  if (elapsedMs != null) {
    parts.push(formatElapsed(elapsedMs));
  }

  if (inputTokens != null || outputTokens != null) {
    const inStr = inputTokens != null ? formatTokenCount(inputTokens) : '0';
    const outStr = outputTokens != null ? formatTokenCount(outputTokens) : '0';
    parts.push(`${inStr} in \u00b7 ${outStr} out`);
  }

  parts.push(formatCost(resolveTotalCost(estimatedTotalCostUsd, estimatedInputCostUsd, estimatedOutputCostUsd)));

  return (
    <div className="text-xs text-foreground-muted text-center pt-2 border-t border-border-subtle">
      {parts.join(' \u00b7 ')}
    </div>
  );
}
