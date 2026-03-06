import { useQuery } from '@tanstack/react-query';
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
  LayoutDashboard,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { StatCard } from '@/components/dashboard/StatCard';
import AiConfigSection from '@/components/super/AiConfigSection';
import ConfigSectionForm from '@/components/super/ConfigSectionForm';
import UsersTable from '@/components/super/UsersTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAllConfig, type ConfigSetting } from '@/services/api/configService';
import { getSuperStats } from '@/services/api/superService';

// ── Config sections ──

const CONFIG_SECTIONS = [
  { key: 'Authentication', label: 'Authentication' },
  { key: 'Ai', label: 'AI' },
  { key: 'Email', label: 'Email' },
  { key: 'Application', label: 'Application' },
] as const;

const VALID_TABS = ['dashboard', 'users', ...CONFIG_SECTIONS.map((s) => s.key.toLowerCase())];
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const activeTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'dashboard';

  const [restartKeys, setRestartKeys] = useState<string[]>([]);

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
          <TabsTrigger value="users" className={TAB_STYLE}>
            <Users className="size-4 hidden sm:block" />
            Users
          </TabsTrigger>
          {CONFIG_SECTIONS.map(({ key, label }) => (
            <TabsTrigger key={key} value={key.toLowerCase()} className={TAB_STYLE}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-6 space-y-6">
          <StatsSection title="Users & Growth" items={userStats} loading={statsLoading} />
          <StatsSection title="Workspaces" items={workspaceStats} loading={statsLoading} />
          <StatsSection title="Content" items={contentStats} loading={statsLoading} />
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          <UsersTable />
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
    </div>
  );
};

export default SuperDashboardPage;
