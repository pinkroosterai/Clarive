import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Info, ScrollText } from "lucide-react";

import { auditService } from "@/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/common/EmptyState";

const PAGE_SIZE = 20;

const actionStyles: Record<string, { color: string; label: string }> = {
  entry_published: { color: "bg-success-bg text-success-text border border-success-border", label: "Published" },
  entry_created:   { color: "bg-info-bg text-info-text border border-info-border", label: "Created" },
  entry_updated:   { color: "bg-warning-bg text-warning-text border border-warning-border", label: "Updated" },
  entry_trashed:   { color: "bg-error-bg text-error-text border border-error-border", label: "Trashed" },
  entry_restored:  { color: "bg-success-bg text-success-text border border-success-border", label: "Restored" },
  entry_deleted:   { color: "bg-error-bg text-error-text border border-error-border", label: "Deleted" },
};

function getActionColor(action: string) {
  return actionStyles[action]?.color ?? "bg-elevated text-foreground-muted";
}

function formatAction(action: string) {
  return actionStyles[action]?.label ?? action.replace(/_/g, " ");
}

function formatEntity(entityType: string) {
  return entityType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogTable() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["auditLog", page],
    queryFn: () => auditService.getAuditLogPage(page, PAGE_SIZE),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-foreground-muted">
        <Info className="size-4 shrink-0" />
        Logs are retained for 30 days.
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data?.entries.length ? (
        <EmptyState
          icon={ScrollText}
          title="No audit log entries"
          description="Activity in your workspace will appear here."
        />
      ) : (
        <TooltipProvider>
          <div className="bg-surface rounded-xl elevation-1 border border-border-subtle overflow-clip">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((entry) => {
                const date = new Date(entry.timestamp);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-foreground-muted text-sm whitespace-nowrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">
                            {formatDistanceToNow(date, { addSuffix: true })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{format(date, "PPpp")}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="font-medium">{entry.userName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`border-0 ${getActionColor(entry.action)}`}
                      >
                        {formatAction(entry.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatEntity(entry.entityType)}
                    </TableCell>
                    <TableCell className="text-sm text-foreground-muted">
                      {entry.details ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
          </div>
        </TooltipProvider>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-elevated border-border"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-foreground-muted">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="bg-elevated border-border"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
