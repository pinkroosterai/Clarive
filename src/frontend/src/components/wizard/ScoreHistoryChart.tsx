import type { IterationScore } from "@/types";

interface ScoreHistoryChartProps {
  history: IterationScore[];
}

export function ScoreHistoryChart({ history }: ScoreHistoryChartProps) {
  if (history.length < 2) return null;

  const width = 200;
  const height = 48;
  const padding = { top: 4, right: 4, bottom: 4, left: 4 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const scores = history.map((h) => h.averageScore);
  const min = Math.max(0, Math.min(...scores) - 1);
  const max = Math.min(10, Math.max(...scores) + 1);

  const range = max - min;
  const points = scores.map((s, i) => {
    const x = padding.left + (i / (scores.length - 1)) * chartW;
    const y = range > 0
      ? padding.top + chartH - ((s - min) / range) * chartH
      : padding.top + chartH / 2;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  const latest = scores[scores.length - 1];
  const previous = scores[scores.length - 2];
  const trend = latest - previous;

  return (
    <div className="pt-2 border-t border-border-subtle">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-foreground-muted">Score trend</span>
        <span className={`text-xs font-medium ${trend > 0 ? "text-success-text" : trend < 0 ? "text-error-text" : "text-foreground-muted"}`}>
          {trend > 0 ? "+" : ""}{trend.toFixed(1)} from last iteration
        </span>
      </div>
      <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path
          d={pathD}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-primary"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === points.length - 1 ? 4 : 3}
            className={i === points.length - 1 ? "fill-primary" : "fill-foreground-muted"}
          />
        ))}
      </svg>
    </div>
  );
}
