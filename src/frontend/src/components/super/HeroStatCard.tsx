import { motion, useSpring, useTransform } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { memo, useEffect } from 'react';

interface HeroStatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  prefix?: string;
  decimals?: number;
  delta?: number;
  deltaLabel?: string;
  index?: number;
}

export const HeroStatCard = memo(function HeroStatCard({
  icon: Icon,
  label,
  value,
  prefix,
  decimals,
  delta,
  deltaLabel = '7d',
  index = 0,
}: HeroStatCardProps) {
  const spring = useSpring(0, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) => {
    const formatted = decimals !== undefined ? v.toFixed(decimals) : Math.round(v).toLocaleString();
    return prefix ? `${prefix}${formatted}` : formatted;
  });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  const deltaColor =
    delta === undefined || delta === 0
      ? 'text-foreground-muted'
      : delta > 0
        ? 'text-success-text'
        : 'text-destructive';

  const DeltaIcon =
    delta === undefined || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border-subtle bg-surface elevation-1 p-6 flex flex-col gap-3 cursor-default"
    >
      <div className="flex items-center justify-between">
        <motion.div
          className="rounded-md bg-primary/10 p-2.5"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.08 + 0.3, type: 'spring', stiffness: 400, damping: 15 }}
        >
          <Icon className="size-5 text-primary" />
        </motion.div>
        {delta !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${deltaColor}`}>
            <DeltaIcon className="size-3" />
            <span>
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
            <span className="text-foreground-muted font-normal">({deltaLabel})</span>
          </div>
        )}
      </div>
      <div>
        <motion.div className="text-4xl font-bold text-foreground tabular-nums tracking-tight">
          {display}
        </motion.div>
        <div className="text-sm text-foreground-muted mt-1">{label}</div>
      </div>
    </motion.div>
  );
});
