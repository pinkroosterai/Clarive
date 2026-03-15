import { motion } from 'framer-motion';
import { memo } from 'react';

export interface MetricItem {
  label: string;
  value: number | string;
  suffix?: string;
}

interface CompactMetricStripProps {
  title: string;
  items: MetricItem[];
  index?: number;
}

export const CompactMetricStrip = memo(function CompactMetricStrip({
  title,
  items,
  index = 0,
}: CompactMetricStripProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.08, duration: 0.3 }}
      className="rounded-lg border border-border-subtle bg-surface/50 px-4 py-3"
    >
      <div className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-1.5">
        {title}
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {items.map((item, i) => (
          <span key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-foreground-muted/40">·</span>}
            <span className="text-foreground-muted">{item.label}:</span>
            <span className="font-medium tabular-nums">
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
              {item.suffix}
            </span>
          </span>
        ))}
      </div>
    </motion.div>
  );
});
