import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Monitor,
  Smartphone,
  Globe,
  Trash2,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { profileService } from "@/services";
import { handleApiError } from "@/lib/handleApiError";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Session } from "@/types";

function getDeviceIcon(os: string) {
  const mobile = ["iOS", "Android"];
  if (mobile.includes(os))
    return <Smartphone className="h-5 w-5 text-foreground-muted" />;
  return <Monitor className="h-5 w-5 text-foreground-muted" />;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: Session;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3">
      {getDeviceIcon(session.os)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {session.browser}
          </span>
          <span className="text-xs text-foreground-muted">{session.os}</span>
          {session.isCurrent && (
            <Badge
              variant="outline"
              className="text-xs border-success-border text-success-text"
            >
              Current
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground-muted mt-0.5">
          <Globe className="h-3 w-3" />
          <span>{session.ipAddress}</span>
          <span>&middot;</span>
          <span>{formatDate(session.createdAt)}</span>
        </div>
      </div>
      {!session.isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          disabled={revoking}
          onClick={() => onRevoke(session.id)}
          className="text-foreground-muted hover:text-destructive"
        >
          {revoking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}

export default function SessionManager() {
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const {
    data: sessions,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["sessions"],
    queryFn: profileService.getSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => profileService.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session revoked");
      setRevokingId(null);
    },
    onError: (err: unknown) => {
      handleApiError(err, { fallback: "Failed to revoke session" });
      setRevokingId(null);
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => profileService.revokeOtherSessions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(
        `${data.revoked} session${data.revoked !== 1 ? "s" : ""} revoked`,
      );
    },
    onError: (err: unknown) =>
      handleApiError(err, { fallback: "Failed to revoke sessions" }),
  });

  function handleRevoke(sessionId: string) {
    setRevokingId(sessionId);
    revokeMutation.mutate(sessionId);
  }

  const otherSessions =
    sessions?.filter((s) => !s.isCurrent).length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold">Active Sessions</h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold">Active Sessions</h2>
        <p className="text-sm text-foreground-muted">
          Failed to load sessions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active Sessions</h2>
        {otherSessions > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={revokeAllMutation.isPending}
              >
                <ShieldAlert className="mr-1.5 h-4 w-4" />
                {revokeAllMutation.isPending
                  ? "Revoking..."
                  : "Revoke All Others"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke all other sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will sign out all other devices. Your current session will
                  not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => revokeAllMutation.mutate()}>
                  Revoke All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="space-y-2">
        {sessions?.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            onRevoke={handleRevoke}
            revoking={revokingId === session.id && revokeMutation.isPending}
          />
        ))}
        {sessions?.length === 0 && (
          <p className="text-sm text-foreground-muted py-4 text-center">
            No active sessions found.
          </p>
        )}
      </div>
    </div>
  );
}
