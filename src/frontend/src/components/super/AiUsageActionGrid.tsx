import type { AiUsageActionBreakdownItem } from '@/services/api/aiUsageService';

const ACTION_LABELS: Record<string, string> = {
  Generation: 'Generation',
  Evaluation: 'Evaluation',
  Clarification: 'Clarification',
  SystemMessage: 'System Message',
  Decomposition: 'Decomposition',
  FillTemplateFields: 'Fill Template Fields',
  PlaygroundJudge: 'Playground Judge',
  PlaygroundTest: 'Playground Test',
};

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatCost(usd: number): string {
  if (usd === 0) return '—';
  return `$${usd.toFixed(4)}`;
}

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString();
}

interface AiUsageActionGridProps {
  items: AiUsageActionBreakdownItem[];
}

export default function AiUsageActionGrid({ items }: AiUsageActionGridProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border-subtle bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Per-Action Overview</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs font-medium text-foreground-muted">
              <th className="pb-2 pr-4">Action</th>
              <th className="pb-2 pr-4">Provider / Model</th>
              <th className="pb-2 pr-4 text-right">Requests</th>
              <th className="pb-2 pr-4 text-right">Avg Tokens In</th>
              <th className="pb-2 pr-4 text-right">Avg Tokens Out</th>
              <th className="pb-2 pr-4 text-right">Avg In Cost</th>
              <th className="pb-2 pr-4 text-right">Avg Out Cost</th>
              <th className="pb-2 text-right">Avg Duration</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.name} className="border-b border-border-subtle/50 last:border-0">
                <td className="py-2 pr-4 font-medium">
                  {ACTION_LABELS[item.name] ?? item.name}
                </td>
                <td className="py-2 pr-4 text-foreground-muted">
                  {item.provider ? `${item.provider}:${item.model}` : item.model}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {item.requestCount.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatNumber(item.avgInputTokens)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatNumber(item.avgOutputTokens)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatCost(item.avgEstimatedInputCostUsd)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {formatCost(item.avgEstimatedOutputCostUsd)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatDuration(item.avgDurationMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
