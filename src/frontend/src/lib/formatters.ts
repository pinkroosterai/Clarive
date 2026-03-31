// ── Token / Cost / Elapsed ──

const tokenFormatter = new Intl.NumberFormat('en-US');

export function formatTokenCount(count: number): string {
  return tokenFormatter.format(count);
}

export function formatCost(totalCost: number | null): string {
  if (totalCost == null) return '\u2014';
  return `~$${totalCost.toFixed(4)}`;
}

export function resolveTotalCost(
  totalCost: number | null | undefined,
  inputCost: number | null | undefined,
  outputCost: number | null | undefined,
): number | null {
  if (totalCost != null) return totalCost;
  if (inputCost != null || outputCost != null) return (inputCost ?? 0) + (outputCost ?? 0);
  return null;
}

export function formatElapsed(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

// ── Dates ──

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
