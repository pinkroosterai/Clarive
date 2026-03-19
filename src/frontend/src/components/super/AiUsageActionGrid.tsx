import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

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

interface ActionGroup {
  action: string;
  label: string;
  totalRequests: number;
  items: AiUsageActionBreakdownItem[];
}

interface AiUsageActionGridProps {
  items: AiUsageActionBreakdownItem[];
}

export default function AiUsageActionGrid({ items }: AiUsageActionGridProps) {
  const groups = useMemo<ActionGroup[]>(() => {
    const map = new Map<string, AiUsageActionBreakdownItem[]>();
    for (const item of items) {
      const existing = map.get(item.name) ?? [];
      existing.push(item);
      map.set(item.name, existing);
    }
    return Array.from(map.entries())
      .map(([action, groupItems]) => ({
        action,
        label: ACTION_LABELS[action] ?? action,
        totalRequests: groupItems.reduce((sum, i) => sum + i.requestCount, 0),
        items: groupItems.sort((a, b) => b.requestCount - a.requestCount),
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);
  }, [items]);

  // Start with top group expanded, others collapsed (if more than 1 model in any group)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (groups.length > 0) initial.add(groups[0].action);
    return initial;
  });

  if (items.length === 0) return null;

  const toggleGroup = (action: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Per-Action Overview</h3>
      <div className="overflow-x-auto scrollbar-themed">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs font-medium text-foreground-muted">
              <th className="pb-2 pr-4 w-8" />
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
            {groups.map((group) => {
              const isExpanded = expanded.has(group.action);
              const hasMultiple = group.items.length > 1;

              return (
                <GroupRows
                  key={group.action}
                  group={group}
                  isExpanded={isExpanded}
                  hasMultiple={hasMultiple}
                  onToggle={() => toggleGroup(group.action)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  group,
  isExpanded,
  hasMultiple,
  onToggle,
}: {
  group: ActionGroup;
  isExpanded: boolean;
  hasMultiple: boolean;
  onToggle: () => void;
}) {
  // If only one model for this action, render a single flat row (no expand/collapse)
  if (!hasMultiple) {
    const item = group.items[0];
    return (
      <tr className="border-b border-border-subtle/50 last:border-0">
        <td className="py-2 pr-1 w-8" />
        <td className="py-2 pr-4 font-medium">{group.label}</td>
        <td className="py-2 pr-4 text-foreground-muted">
          {item.provider ? `${item.provider}:${item.model}` : item.model}
        </td>
        <td className="py-2 pr-4 text-right tabular-nums">
          {item.requestCount.toLocaleString()}
        </td>
        <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(item.avgInputTokens)}</td>
        <td className="py-2 pr-4 text-right tabular-nums">{formatNumber(item.avgOutputTokens)}</td>
        <td className="py-2 pr-4 text-right tabular-nums">
          {formatCost(item.avgEstimatedInputCostUsd)}
        </td>
        <td className="py-2 pr-4 text-right tabular-nums">
          {formatCost(item.avgEstimatedOutputCostUsd)}
        </td>
        <td className="py-2 text-right tabular-nums">{formatDuration(item.avgDurationMs)}</td>
      </tr>
    );
  }

  // Multiple models — collapsible group
  return (
    <>
      {/* Group header row */}
      <tr
        className="border-b border-border-subtle/50 cursor-pointer hover:bg-elevated/50 transition-colors"
        onClick={onToggle}
      >
        <td className="py-2 pr-1 w-8 text-foreground-muted">
          {isExpanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </td>
        <td className="py-2 pr-4 font-medium">{group.label}</td>
        <td className="py-2 pr-4 text-foreground-muted text-xs">
          {group.items.length} models
        </td>
        <td className="py-2 pr-4 text-right tabular-nums font-medium">
          {group.totalRequests.toLocaleString()}
        </td>
        <td className="py-2 pr-4" colSpan={5} />
      </tr>

      {/* Expanded child rows */}
      {isExpanded &&
        group.items.map((item) => (
          <tr
            key={`${item.name}-${item.provider}-${item.model}`}
            className="border-b border-border-subtle/30 last:border-border-subtle/50 bg-elevated/30"
          >
            <td className="py-1.5 pr-1 w-8" />
            <td className="py-1.5 pr-4" />
            <td className="py-1.5 pr-4 text-foreground-muted text-xs">
              {item.provider ? `${item.provider}:${item.model}` : item.model}
            </td>
            <td className="py-1.5 pr-4 text-right tabular-nums text-xs">
              {item.requestCount.toLocaleString()}
            </td>
            <td className="py-1.5 pr-4 text-right tabular-nums text-xs">
              {formatNumber(item.avgInputTokens)}
            </td>
            <td className="py-1.5 pr-4 text-right tabular-nums text-xs">
              {formatNumber(item.avgOutputTokens)}
            </td>
            <td className="py-1.5 pr-4 text-right tabular-nums text-xs">
              {formatCost(item.avgEstimatedInputCostUsd)}
            </td>
            <td className="py-1.5 pr-4 text-right tabular-nums text-xs">
              {formatCost(item.avgEstimatedOutputCostUsd)}
            </td>
            <td className="py-1.5 text-right tabular-nums text-xs">
              {formatDuration(item.avgDurationMs)}
            </td>
          </tr>
        ))}
    </>
  );
}
