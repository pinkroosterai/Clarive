import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  UserPlus,
  BadgeCheck,
  Compass,
  Trash2,
  KeyRound,
  Building2,
  UsersRound,
  UserCheck,
  Mail,
  MailCheck,
  FileText,
  BookOpen,
  FilePlus,
  Archive,
  Bot,
  BotMessageSquare,
  Coins,
  CreditCard,
  TrendingDown,
  Receipt,
  Key,
  Power,
  ShieldAlert,
  Settings,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatCard } from "@/components/dashboard/StatCard";
import { getSuperStats, getMaintenanceStatus, setMaintenanceMode } from "@/services/api/superService";
import { getFeedbackList, type FeedbackEntry } from "@/services/api/feedbackService";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

interface StatItem {
  icon: LucideIcon;
  label: string;
  value: number;
}

function StatsSection({ title, items, loading }: { title: string; items: StatItem[]; loading: boolean }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold border-b border-border pb-2">{title}</h2>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {loading
          ? Array.from({ length: items.length }).map((_, i) => (
              <div key={i} className="h-[88px] animate-pulse rounded-xl bg-muted" />
            ))
          : items.map((item) => (
              <StatCard key={item.label} icon={item.icon} label={item.label} value={item.value} />
            ))}
      </div>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  Bug: "bg-error-bg text-error-text border-error-border",
  FeatureRequest: "bg-info-bg text-info-text border-info-border",
  General: "bg-status-historical-bg text-status-historical-text border-status-historical-border",
};

const CATEGORY_LABELS: Record<string, string> = {
  Bug: "Bug",
  FeatureRequest: "Feature Request",
  General: "General",
};

function FeedbackSection() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["super", "feedback", page],
    queryFn: () => getFeedbackList(page, 10),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="size-4" />
          User Feedback
          {data && (
            <span className="text-sm font-normal text-foreground-muted">({data.total})</span>
          )}
        </h2>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-foreground-muted px-1">
              {page}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !data?.entries.length ? (
        <p className="text-sm text-foreground-muted py-4 text-center">No feedback yet.</p>
      ) : (
        <div className="space-y-2">
          {data.entries.map((entry: FeedbackEntry) => (
            <Card key={entry.id} className="rounded-xl elevation-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{entry.userName}</span>
                    <span className="text-xs text-foreground-muted">{entry.userEmail}</span>
                    <Badge variant="outline" className={CATEGORY_COLORS[entry.category] ?? ""}>
                      {CATEGORY_LABELS[entry.category] ?? entry.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{entry.message}</p>
                  <div className="flex items-center gap-3 text-xs text-foreground-muted">
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                    {entry.pageUrl && <span>Page: {entry.pageUrl}</span>}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const SuperDashboardPage = () => {
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const setStoreMaintenanceMode = useAuthStore((s) => s.setMaintenanceMode);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["super", "stats"],
    queryFn: getSuperStats,
  });

  const { data: maintenance, isLoading: maintenanceLoading } = useQuery({
    queryKey: ["super", "maintenance"],
    queryFn: getMaintenanceStatus,
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => setMaintenanceMode(enabled),
    onSuccess: (data) => {
      queryClient.setQueryData(["super", "maintenance"], data);
      setStoreMaintenanceMode(data.enabled);
      toast.success(
        data.enabled
          ? "Maintenance mode enabled — regular users are blocked"
          : "Maintenance mode disabled — all users can access the system",
      );
    },
    onError: () => {
      toast.error("Failed to toggle maintenance mode");
    },
  });

  const handleToggle = () => {
    const newState = !maintenance?.enabled;
    if (newState) {
      setShowConfirm(true);
    } else {
      toggleMutation.mutate(false);
    }
  };

  const confirmEnable = () => {
    setShowConfirm(false);
    toggleMutation.mutate(true);
  };

  const isEnabled = maintenance?.enabled ?? false;

  const userStats: StatItem[] = [
    { icon: Users, label: "Total Users", value: stats?.totalUsers ?? 0 },
    { icon: UserPlus, label: "New Users (7d)", value: stats?.newUsers7d ?? 0 },
    { icon: UserPlus, label: "New Users (30d)", value: stats?.newUsers30d ?? 0 },
    { icon: BadgeCheck, label: "Verified (%)", value: Math.round((stats?.verifiedPct ?? 0) * 100) },
    { icon: Compass, label: "Onboarded (%)", value: Math.round((stats?.onboardedPct ?? 0) * 100) },
    { icon: Trash2, label: "Pending Deletion", value: stats?.pendingDeletion ?? 0 },
    { icon: KeyRound, label: "Google Auth Users", value: stats?.googleAuthUsers ?? 0 },
  ];

  const workspaceStats: StatItem[] = [
    { icon: Building2, label: "Total Workspaces", value: stats?.totalWorkspaces ?? 0 },
    { icon: UsersRound, label: "Shared Workspaces", value: stats?.sharedWorkspaces ?? 0 },
    { icon: UserCheck, label: "Avg Members/Workspace", value: Math.round((stats?.avgMembersPerWorkspace ?? 0) * 10) / 10 },
    { icon: Mail, label: "Pending Invitations", value: stats?.pendingInvitations ?? 0 },
    { icon: MailCheck, label: "Invite Accept Rate (%)", value: Math.round((stats?.invitationAcceptRate ?? 0) * 100) },
  ];

  const contentStats: StatItem[] = [
    { icon: FileText, label: "Total Entries", value: stats?.totalEntries ?? 0 },
    { icon: BookOpen, label: "Published Versions", value: stats?.publishedVersions ?? 0 },
    { icon: FilePlus, label: "Entries Created (7d)", value: stats?.entriesCreated7d ?? 0 },
    { icon: Archive, label: "Trashed Entries", value: stats?.trashedEntries ?? 0 },
    { icon: Bot, label: "Total AI Sessions", value: stats?.totalAiSessions ?? 0 },
    { icon: BotMessageSquare, label: "AI Sessions (7d)", value: stats?.aiSessions7d ?? 0 },
  ];

  const creditStats: StatItem[] = [
    { icon: Coins, label: "Total Free Credits", value: stats?.totalFreeCredits ?? 0 },
    { icon: CreditCard, label: "Total Purchased Credits", value: stats?.totalPurchasedCredits ?? 0 },
    { icon: TrendingDown, label: "Credits Used (30d)", value: stats?.creditsUsed30d ?? 0 },
    { icon: Receipt, label: "Total Transactions", value: stats?.totalTransactions ?? 0 },
    { icon: Key, label: "Total API Keys", value: stats?.totalApiKeys ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Super Admin Dashboard</h1>
        </div>
      </div>

      {/* Operations */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={`rounded-xl elevation-1 ${isEnabled ? "border-warning-border bg-warning-bg" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Maintenance Mode</CardTitle>
            <Power className={`size-4 ${isEnabled ? "text-warning-text" : "text-foreground-muted"}`} />
          </CardHeader>
          <CardContent>
            {maintenanceLoading ? (
              <div className="h-8 w-24 animate-pulse rounded bg-muted" />
            ) : (
              <>
                <div className={`text-lg font-semibold ${isEnabled ? "text-warning-text" : "text-success-text"}`}>
                  {isEnabled ? "Active" : "Inactive"}
                </div>
                <CardDescription className="mt-1">
                  {isEnabled
                    ? "Regular users are blocked from accessing the system"
                    : "All users can access the system normally"}
                </CardDescription>
                <Button
                  variant={isEnabled ? "default" : "destructive"}
                  size="sm"
                  className="mt-3"
                  onClick={handleToggle}
                  disabled={toggleMutation.isPending}
                >
                  {toggleMutation.isPending
                    ? "Toggling..."
                    : isEnabled
                      ? "Disable Maintenance"
                      : "Enable Maintenance"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl elevation-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Service Configuration</CardTitle>
            <Settings className="size-4 text-foreground-muted" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Configure external services, API keys, and application settings
            </CardDescription>
            <Link to="/super/config">
              <Button variant="outline" size="sm" className="mt-3">
                Manage Configuration
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Metric Sections */}
      <StatsSection title="Users & Growth" items={userStats} loading={statsLoading} />
      <StatsSection title="Workspaces" items={workspaceStats} loading={statsLoading} />
      <StatsSection title="Content" items={contentStats} loading={statsLoading} />
      <StatsSection title="Credits" items={creditStats} loading={statsLoading} />

      {/* Feedback */}
      <FeedbackSection />

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Maintenance Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              This will block all non-super-user access to Clarive. Regular users will see a
              maintenance page and their API requests will return 503 errors. Health checks will
              remain accessible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Enable Maintenance Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperDashboardPage;
