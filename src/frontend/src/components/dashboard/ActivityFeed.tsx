import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Activity, Plus, Pencil, Globe, Trash2, RotateCcw, type LucideIcon } from 'lucide-react';
import { memo } from 'react';

import type { RecentActivity } from '@/types';

interface ActivityFeedProps {
  activities: RecentActivity[];
}

const actionConfig: Record<string, { icon: LucideIcon; color: string }> = {
  entry_created: { icon: Plus, color: 'text-info-text' },
  entry_published: { icon: Globe, color: 'text-success-text' },
  entry_trashed: { icon: Trash2, color: 'text-error-text' },
  entry_restored: { icon: RotateCcw, color: 'text-success-text' },
  entry_deleted: { icon: Trash2, color: 'text-error-text' },
  version_promoted: { icon: Pencil, color: 'text-warning-text' },
};

function getActionConfig(action: string) {
  return actionConfig[action] ?? { icon: Activity, color: 'text-foreground-muted' };
}

export const ActivityFeed = memo(function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-border-subtle bg-surface elevation-1"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <Activity className="size-4 text-foreground-muted" />
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
      </div>

      {activities.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-foreground-muted">Start editing prompts to see your activity here</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[27px] top-3 bottom-3 w-px bg-border-subtle" />

          {activities.map((item, i) => {
            const config = getActionConfig(item.action);
            const Icon = config.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.04, duration: 0.3 }}
                className="relative flex items-start gap-3 px-4 py-3"
              >
                <motion.div
                  className={`relative z-10 mt-0.5 rounded-full bg-surface p-0.5 ${config.color}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    delay: 0.45 + i * 0.04,
                    type: 'spring',
                    stiffness: 400,
                    damping: 15,
                  }}
                >
                  <Icon className="size-4" />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {item.details ?? `${item.userName} performed ${item.action.replace(/_/g, ' ')}`}
                  </p>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {item.userName} &middot;{' '}
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
});
