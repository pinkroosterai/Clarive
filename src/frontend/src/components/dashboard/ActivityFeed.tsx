import { memo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Plus,
  Pencil,
  Globe,
  Trash2,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import type { RecentActivity } from "@/types";

interface ActivityFeedProps {
  activities: RecentActivity[];
}

const actionConfig: Record<string, { icon: LucideIcon; color: string }> = {
  entry_created:   { icon: Plus, color: "text-info-text" },
  entry_published: { icon: Globe, color: "text-success-text" },
  entry_trashed:   { icon: Trash2, color: "text-error-text" },
  entry_restored:  { icon: RotateCcw, color: "text-success-text" },
  entry_deleted:   { icon: Trash2, color: "text-error-text" },
  version_promoted:{ icon: Pencil, color: "text-warning-text" },
};

function getActionConfig(action: string) {
  return actionConfig[action] ?? { icon: Activity, color: "text-foreground-muted" };
}

export const ActivityFeed = memo(function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface elevation-1">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <Activity className="size-4 text-foreground-muted" />
        <h2 className="text-sm font-semibold text-foreground">Activity</h2>
      </div>

      {activities.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-foreground-muted">No activity yet</p>
      ) : (
        <div className="divide-y divide-border-subtle">
          {activities.map((item) => {
            const config = getActionConfig(item.action);
            const Icon = config.icon;
            return (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                <div className={`mt-0.5 ${config.color}`}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {item.details ?? `${item.userName} performed ${item.action.replace(/_/g, " ")}`}
                  </p>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {item.userName} &middot; {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
