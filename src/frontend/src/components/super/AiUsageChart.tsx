import { Bar, BarChart, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { AiUsageBreakdownItem } from '@/services/api/aiUsageService';

const chartConfig = {
  inputTokens: {
    label: 'Input Tokens',
    color: 'hsl(var(--chart-1))',
  },
  outputTokens: {
    label: 'Output Tokens',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig;

interface AiUsageChartProps {
  byModel: AiUsageBreakdownItem[];
}

export default function AiUsageChart({ byModel }: AiUsageChartProps) {
  if (byModel.length === 0) return null;

  const data = byModel.map((item) => ({
    name: item.name,
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
  }));

  return (
    <div className="rounded-xl border border-border-subtle bg-surface elevation-1 p-6">
      <h4 className="text-sm font-semibold text-foreground mb-4">Token Usage by Model</h4>
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <BarChart data={data} accessibilityLayer>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
            interval={0}
            tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 18)}…` : v)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="inputTokens" fill="var(--color-inputTokens)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="outputTokens" fill="var(--color-outputTokens)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
