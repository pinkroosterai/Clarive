import { useState, useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AiUsageBreakdownItem, AiUsageStatsResponse } from '@/services/api/aiUsageService';

type SortKey = keyof AiUsageBreakdownItem;
type SortDir = 'asc' | 'desc';

interface AiUsageBreakdownTablesProps {
  stats: AiUsageStatsResponse;
}

type ColumnFormat = 'number' | 'percentage' | 'usd';

const columns: { key: SortKey; label: string; align?: 'right'; format?: ColumnFormat }[] = [
  { key: 'name', label: 'Name' },
  { key: 'requestCount', label: 'Requests', align: 'right', format: 'number' },
  { key: 'inputTokens', label: 'Input Tokens', align: 'right', format: 'number' },
  { key: 'outputTokens', label: 'Output Tokens', align: 'right', format: 'number' },
  { key: 'totalTokens', label: 'Total Tokens', align: 'right', format: 'number' },
  { key: 'percentage', label: '% of Total', align: 'right', format: 'percentage' },
  { key: 'estimatedInputCostUsd', label: 'Input Cost', align: 'right', format: 'usd' },
  { key: 'estimatedOutputCostUsd', label: 'Output Cost', align: 'right', format: 'usd' },
  { key: 'estimatedCostUsd', label: 'Total Cost', align: 'right', format: 'usd' },
];

function formatCell(value: string | number, format?: ColumnFormat): string {
  if (format === 'usd') {
    const num = value as number;
    return num > 0 ? `$${num.toFixed(2)}` : '\u2014';
  }
  if (format === 'percentage') return `${(value as number).toFixed(1)}%`;
  if (format === 'number') return (value as number).toLocaleString();
  return String(value);
}

function BreakdownTable({ items }: { items: AiUsageBreakdownItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('totalTokens');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return copy;
  }, [items, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (items.length === 0) {
    return <p className="text-sm text-foreground-muted py-4">No data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 px-3 font-medium text-foreground-muted cursor-pointer hover:text-foreground select-none whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                onClick={() => toggleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  <ArrowUpDown className={`size-3 ${sortKey === col.key ? 'text-foreground' : 'opacity-40'}`} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-b border-border-subtle/50 hover:bg-surface-hover">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2 px-3 tabular-nums whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-foreground'} ${col.key === 'totalTokens' || col.key === 'estimatedCostUsd' ? 'font-medium' : ''}`}
                >
                  {formatCell(row[col.key], col.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TAB_STYLE =
  'gap-1.5 text-foreground-muted hover:text-foreground-secondary data-[state=active]:bg-surface data-[state=active]:elevation-1 data-[state=active]:rounded-md data-[state=active]:text-foreground';

export default function AiUsageBreakdownTables({ stats }: AiUsageBreakdownTablesProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-6">
      <h4 className="text-sm font-semibold text-foreground mb-4">Usage Breakdown</h4>
      <Tabs defaultValue="model">
        <TabsList className="h-auto justify-start bg-elevated rounded-lg p-1 mb-4">
          <TabsTrigger value="model" className={TAB_STYLE}>By Model</TabsTrigger>
          <TabsTrigger value="tenant" className={TAB_STYLE}>By Tenant</TabsTrigger>
          <TabsTrigger value="user" className={TAB_STYLE}>By User</TabsTrigger>
          <TabsTrigger value="action" className={TAB_STYLE}>By Action Type</TabsTrigger>
        </TabsList>
        <TabsContent value="model"><BreakdownTable items={stats.byModel} /></TabsContent>
        <TabsContent value="tenant"><BreakdownTable items={stats.byTenant} /></TabsContent>
        <TabsContent value="user"><BreakdownTable items={stats.byUser} /></TabsContent>
        <TabsContent value="action"><BreakdownTable items={stats.byActionType} /></TabsContent>
      </Tabs>
    </div>
  );
}
