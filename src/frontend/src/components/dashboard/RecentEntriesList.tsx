import { memo } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Clock } from "lucide-react";

import type { RecentEntry } from "@/types";
import { Badge } from "@/components/ui/badge";

interface RecentEntriesListProps {
  entries: RecentEntry[];
}

const badgeVariant: Record<string, { variant: "draft" | "published"; label: string }> = {
  draft: { variant: "draft", label: "Draft" },
  published: { variant: "published", label: "Published" },
};

export const RecentEntriesList = memo(function RecentEntriesList({ entries }: RecentEntriesListProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface elevation-1">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
        <Clock className="size-4 text-foreground-muted" />
        <h2 className="text-sm font-semibold text-foreground">Recent Entries</h2>
      </div>

      {entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-foreground-muted">No entries yet</p>
      ) : (
        <div className="divide-y divide-border-subtle">
          {entries.map((entry) => {
            const badge = badgeVariant[entry.versionState] ?? { variant: "draft" as const, label: entry.versionState };
            return (
              <Link
                key={entry.id}
                to={`/entry/${entry.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-elevated transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{entry.title}</p>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {formatDistanceToNow(new Date(entry.updatedAt), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant={badge.variant} className="shrink-0">
                  {badge.label}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
});
