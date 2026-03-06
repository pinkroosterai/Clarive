import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
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
  Key,
  Power,
  LayoutDashboard,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { StatCard } from '@/components/dashboard/StatCard';
import AiConfigSection from '@/components/super/AiConfigSection';
import ConfigSectionForm from '@/components/super/ConfigSectionForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAllConfig, type ConfigSetting } from '@/services/api/configService';
import {
  getSuperStats,
  getMaintenanceStatus,
  setMaintenanceMode,
} from '@/services/api/superService';
import { useAuthStore } from '@/store/authStore';

// ── Config sections ──

const CONFIG_SECTIONS = [
  { key: 'Authentication', label: 'Authentication' },
  { key: 'Ai', label: 'AI' },
  { key: 'Email', label: 'Email' },
  { key: 'Application', label: 'Application' },
] as const;

const VALID_TABS = ['dashboard', ...CONFIG_SECTIONS.map((s) => s.key.toLowerCase())];
const RESTART_STORAGE_KEY = 'cl_pending_restart_keys';

const TAB_STYLE =
  'gap-1.5 min-h-[44px] text-foreground-muted hover:text-foreground-secondary data-[state=active]:bg-surface data-[state=active]:elevation-1 data-[state=active]:rounded-md data-[state=active]:text-foreground';

// ── Stats helpers ──

interface StatItem {
  icon: LucideIcon;
  label: string;
  value: number;
}

function StatsSection({
  title,
  items,
  loading,
}: {
  title: string;
  items: StatItem[];
  loading: boolean;
}) {
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

// ── Page ──

const SuperDashboardPage = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const activeTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'dashboard';

  const [showConfirm, setShowConfirm] = useState(false);
  const [restartKeys, setRestartKeys] = useState<string[]>([]);
  const setStoreMaintenanceMode = useAuthStore((s) => s.setMaintenanceMode);

  useEffect(() => {
    document.title = 'Clarive — Super Admin';
  }, []);

  // Load restart-required keys from sessionStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(RESTART_STORAGE_KEY) || '[]') as string[];
      setRestartKeys(stored);
    } catch {
      setRestartKeys([]);
    }
  }, []);

  const refreshRestartKeys = () => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(RESTART_STORAGE_KEY) || '[]') as string[];
      setRestartKeys(stored);
    } catch {
      setRestartKeys([]);
    }
  };

  const clearRestartKeys = () => {
    sessionStorage.removeItem(RESTART_STORAGE_KEY);
    setRestartKeys([]);
  };

  // ── Dashboard data ──

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['super', 'stats'],
    queryFn: getSuperStats,
  });

  const { data: maintenance, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['super', 'maintenance'],
    queryFn: getMaintenanceStatus,
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => setMaintenanceMode(enabled),
    onSuccess: (data) => {
      queryClient.setQueryData(['super', 'maintenance'], data);
      setStoreMaintenanceMode(data.enabled);
      toast.success(
        data.enabled
          ? 'Maintenance mode enabled — regular users are blocked'
          : 'Maintenance mode disabled — all users can access the system'
      );
    },
    onError: () => {
      toast.error('Failed to toggle maintenance mode');
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

  // ── Config data ──

  const {
    data: settings,
    isLoading: configLoading,
    isError: configError,
  } = useQuery({
    queryKey: ['super', 'config'],
    queryFn: getAllConfig,
  });

  const settingsBySection = useMemo(() => {
    if (!settings) return {} as Record<string, ConfigSetting[]>;
    return settings.reduce(
      (acc, setting) => {
        const section = setting.section.toLowerCase();
        if (!acc[section]) acc[section] = [];
        acc[section].push(setting);
        return acc;
      },
      {} as Record<string, ConfigSetting[]>
    );
  }, [settings]);

  // ── Stat definitions ──

  const userStats: StatItem[] = [
    { icon: Users, label: 'Total Users', value: stats?.totalUsers ?? 0 },
    { icon: UserPlus, label: 'New Users (7d)', value: stats?.newUsers7d ?? 0 },
    { icon: UserPlus, label: 'New Users (30d)', value: stats?.newUsers30d ?? 0 },
    { icon: BadgeCheck, label: 'Verified (%)', value: Math.round((stats?.verifiedPct ?? 0) * 100) },
    { icon: Compass, label: 'Onboarded (%)', value: Math.round((stats?.onboardedPct ?? 0) * 100) },
    { icon: Trash2, label: 'Pending Deletion', value: stats?.pendingDeletion ?? 0 },
    { icon: KeyRound, label: 'Google Auth Users', value: stats?.googleAuthUsers ?? 0 },
  ];

  const workspaceStats: StatItem[] = [
    { icon: Building2, label: 'Total Workspaces', value: stats?.totalWorkspaces ?? 0 },
    { icon: UsersRound, label: 'Shared Workspaces', value: stats?.sharedWorkspaces ?? 0 },
    {
      icon: UserCheck,
      label: 'Avg Members/Workspace',
      value: Math.round((stats?.avgMembersPerWorkspace ?? 0) * 10) / 10,
    },
    { icon: Mail, label: 'Pending Invitations', value: stats?.pendingInvitations ?? 0 },
    {
      icon: MailCheck,
      label: 'Invite Accept Rate (%)',
      value: Math.round((stats?.invitationAcceptRate ?? 0) * 100),
    },
  ];

  const contentStats: StatItem[] = [
    { icon: FileText, label: 'Total Entries', value: stats?.totalEntries ?? 0 },
    { icon: BookOpen, label: 'Published Versions', value: stats?.publishedVersions ?? 0 },
    { icon: FilePlus, label: 'Entries Created (7d)', value: stats?.entriesCreated7d ?? 0 },
    { icon: Archive, label: 'Trashed Entries', value: stats?.trashedEntries ?? 0 },
    { icon: Bot, label: 'Total AI Sessions', value: stats?.totalAiSessions ?? 0 },
    { icon: BotMessageSquare, label: 'AI Sessions (7d)', value: stats?.aiSessions7d ?? 0 },
    { icon: Key, label: 'Total API Keys', value: stats?.totalApiKeys ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Super Admin</h1>

      {/* Restart Banner */}
      {restartKeys.length > 0 && (
        <Alert className="border-warning-border bg-warning-bg">
          <AlertTriangle className="size-4 text-warning-text" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              Settings changed that require a restart to take effect. Restart the backend container
              to apply.
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearRestartKeys}
              className="shrink-0 size-6"
            >
              <X className="size-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setSearchParams({ tab }, { replace: true })}
        className="w-full"
      >
        <TabsList className="w-full h-auto justify-start flex-wrap bg-elevated rounded-lg p-1">
          <TabsTrigger value="dashboard" className={TAB_STYLE}>
            <LayoutDashboard className="size-4 hidden sm:block" />
            Dashboard
          </TabsTrigger>
          {CONFIG_SECTIONS.map(({ key, label }) => (
            <TabsTrigger key={key} value={key.toLowerCase()} className={TAB_STYLE}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-6 space-y-6">
          {/* Maintenance Card */}
          <Card
            className={`rounded-xl elevation-1 ${isEnabled ? 'border-warning-border bg-warning-bg' : ''}`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Maintenance Mode</CardTitle>
              <Power
                className={`size-4 ${isEnabled ? 'text-warning-text' : 'text-foreground-muted'}`}
              />
            </CardHeader>
            <CardContent>
              {maintenanceLoading ? (
                <div className="h-8 w-24 animate-pulse rounded bg-muted" />
              ) : (
                <>
                  <div
                    className={`text-lg font-semibold ${isEnabled ? 'text-warning-text' : 'text-success-text'}`}
                  >
                    {isEnabled ? 'Active' : 'Inactive'}
                  </div>
                  <CardDescription className="mt-1">
                    {isEnabled
                      ? 'Regular users are blocked from accessing the system'
                      : 'All users can access the system normally'}
                  </CardDescription>
                  <Button
                    variant={isEnabled ? 'default' : 'destructive'}
                    size="sm"
                    className="mt-3"
                    onClick={handleToggle}
                    disabled={toggleMutation.isPending}
                  >
                    {toggleMutation.isPending
                      ? 'Toggling...'
                      : isEnabled
                        ? 'Disable Maintenance'
                        : 'Enable Maintenance'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <StatsSection title="Users & Growth" items={userStats} loading={statsLoading} />
          <StatsSection title="Workspaces" items={workspaceStats} loading={statsLoading} />
          <StatsSection title="Content" items={contentStats} loading={statsLoading} />
        </TabsContent>

        {/* Config Tabs */}
        {CONFIG_SECTIONS.map(({ key }) => {
          const sectionSettings = settingsBySection[key.toLowerCase()] ?? [];
          return (
            <TabsContent key={key} value={key.toLowerCase()} className="mt-6">
              {configLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : configError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>
                    Failed to load configuration settings. Check that the backend is running and the
                    database migration has been applied.
                  </AlertDescription>
                </Alert>
              ) : sectionSettings.length > 0 ? (
                key === 'Ai' ? (
                  <AiConfigSection settings={sectionSettings} onSaved={refreshRestartKeys} />
                ) : (
                  <ConfigSectionForm settings={sectionSettings} onSaved={refreshRestartKeys} />
                )
              ) : (
                <p className="text-sm text-foreground-muted">No settings in this section.</p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Maintenance Confirmation Dialog */}
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
            <AlertDialogAction
              onClick={confirmEnable}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Enable Maintenance Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperDashboardPage;
