import { motion, useSpring, useTransform } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { memo, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  index?: number;
  to?: string;
}

export const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
  index = 0,
  to,
}: StatCardProps) {
  const spring = useSpring(0, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.02, boxShadow: '0 4px 20px -4px hsl(var(--primary) / 0.12)' }}
      className={`rounded-xl border border-border-subtle bg-surface elevation-1 p-4 flex items-center gap-4 ${to ? 'hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer' : 'cursor-default'}`}
    >
      <motion.div
        className="rounded-md bg-primary/10 p-2.5"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: index * 0.06 + 0.3, type: 'spring', stiffness: 400, damping: 15 }}
      >
        <Icon className="size-5 text-primary" />
      </motion.div>
      <div>
        <motion.div className="text-2xl font-bold text-foreground tabular-nums">
          {display}
        </motion.div>
        <div className="text-sm text-foreground-muted">{label}</div>
      </div>
    </motion.div>
  );

  if (to) {
    return (
      <Link to={to} className="no-underline">
        {card}
      </Link>
    );
  }

  return card;
});
