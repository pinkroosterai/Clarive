const tokenFormatter = new Intl.NumberFormat('en-US');

function formatCost(total: number | null): string {
  if (total == null) return '\u2014';
  return `~$${total.toFixed(4)}`;
}

function resolveTotalCost(
  totalCost: number | null | undefined,
  inputCost: number | null | undefined,
  outputCost: number | null | undefined,
): number | null {
  if (totalCost != null) return totalCost;
  if (inputCost != null || outputCost != null) return (inputCost ?? 0) + (outputCost ?? 0);
  return null;
}

function formatTokens(count: number): string {
  return tokenFormatter.format(count);
}

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
    parts.push(elapsedMs >= 1000 ? `${(elapsedMs / 1000).toFixed(1)}s` : `${elapsedMs}ms`);
  }

  if (inputTokens != null || outputTokens != null) {
    const inStr = inputTokens != null ? formatTokens(inputTokens) : '0';
    const outStr = outputTokens != null ? formatTokens(outputTokens) : '0';
    parts.push(`${inStr} in \u00b7 ${outStr} out`);
  }

  parts.push(formatCost(resolveTotalCost(estimatedTotalCostUsd, estimatedInputCostUsd, estimatedOutputCostUsd)));

  return (
    <div className="text-xs text-foreground-muted text-center pt-2 border-t border-border-subtle">
      {parts.join(' \u00b7 ')}
    </div>
  );
}
