import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  FileText,
  Bot,
  LayoutDashboard,
  AlertTriangle,
  X,
  Settings,
  Cpu,
  ScrollText,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import AiTab from '@/components/super/AiTab';
import LogsTab from '@/components/super/LogsTab';
import AiUsageDashboard from '@/components/super/AiUsageDashboard';
import { CompactMetricStrip, type MetricItem } from '@/components/super/CompactMetricStrip';
import { HeroStatCard } from '@/components/super/HeroStatCard';
import SettingsTab from '@/components/super/SettingsTab';
import UsersTable from '@/components/super/UsersTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { safeSessionStorageGet } from '@/lib/utils';
import { getAllConfig, type ConfigSetting } from '@/services/api/configService';
import { getSuperStats } from '@/services/api/superService';

// ── Tab configuration ──

const VALID_TABS = ['dashboard', 'users', 'ai', 'settings', 'logs'];
const RESTART_STORAGE_KEY = 'cl_pending_restart_keys';

// Map old tab param values to new ones for backwards compatibility
const TAB_REDIRECTS: Record<string, string> = {
  overview: 'dashboard',
  usage: 'dashboard',
  'ai-providers': 'ai',
  authentication: 'settings',
  email: 'settings',
  application: 'settings',
};

const TAB_STYLE =
  'gap-1.5 min-h-[44px] text-foreground-muted hover:text-foreground data-[state=active]:bg-surface data-[state=active]:elevation-1 data-[state=active]:rounded-md data-[state=active]:text-foreground';

// ── Page ──

const SuperDashboardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');

  // Handle redirects from old tab values
  useEffect(() => {
    if (tabFromUrl && TAB_REDIRECTS[tabFromUrl]) {
      setSearchParams({ tab: TAB_REDIRECTS[tabFromUrl] }, { replace: true });
    }
  }, [tabFromUrl, setSearchParams]);

  const activeTab =
    tabFromUrl && VALID_TABS.includes(tabFromUrl)
      ? tabFromUrl
      : tabFromUrl && TAB_REDIRECTS[tabFromUrl]
        ? TAB_REDIRECTS[tabFromUrl]
        : 'dashboard';

  const [restartKeys, setRestartKeys] = useState<string[]>([]);

  useEffect(() => {
    document.title = 'Clarive — Super Admin';
  }, []);

  // Load restart-required keys from sessionStorage
  useEffect(() => {
    setRestartKeys(safeSessionStorageGet<string[]>(RESTART_STORAGE_KEY, []));
  }, []);

  const refreshRestartKeys = () => {
    setRestartKeys(safeSessionStorageGet<string[]>(RESTART_STORAGE_KEY, []));
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

  // ── Compact metric strip data ──

  const userAuthMetrics: MetricItem[] = [
    { label: 'Verified', value: Math.round((stats?.verifiedPct ?? 0) * 100), suffix: '%' },
    { label: 'Onboarded', value: Math.round((stats?.onboardedPct ?? 0) * 100), suffix: '%' },
    { label: 'Google Auth', value: stats?.googleAuthUsers ?? 0 },
    { label: 'Pending Deletion', value: stats?.pendingDeletion ?? 0 },
  ];

  const workspaceMetrics: MetricItem[] = [
    { label: 'Total', value: stats?.totalWorkspaces ?? 0 },
    { label: 'Shared', value: stats?.sharedWorkspaces ?? 0 },
    {
      label: 'Avg Members',
      value: Math.round((stats?.avgMembersPerWorkspace ?? 0) * 10) / 10,
    },
    { label: 'Pending Invites', value: stats?.pendingInvitations ?? 0 },
    {
      label: 'Accept Rate',
      value: Math.round((stats?.invitationAcceptRate ?? 0) * 100),
      suffix: '%',
    },
  ];

  const contentMetrics: MetricItem[] = [
    { label: 'Published', value: stats?.publishedVersions ?? 0 },
    { label: 'Drafts', value: (stats?.totalEntries ?? 0) - (stats?.publishedVersions ?? 0) },
    { label: 'Trashed', value: stats?.trashedEntries ?? 0 },
    { label: 'API Keys', value: stats?.totalApiKeys ?? 0 },
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
        <TabsList className="w-full h-auto justify-start bg-elevated rounded-lg p-1">
          <TabsTrigger value="dashboard" className={TAB_STYLE}>
            <LayoutDashboard className="size-4 hidden sm:block" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="users" className={TAB_STYLE}>
            <Users className="size-4 hidden sm:block" />
            Users
          </TabsTrigger>
          <TabsTrigger value="ai" className={TAB_STYLE}>
            <Cpu className="size-4 hidden sm:block" />
            AI
          </TabsTrigger>
          <TabsTrigger value="settings" className={TAB_STYLE}>
            <Settings className="size-4 hidden sm:block" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="logs" className={TAB_STYLE}>
            <ScrollText className="size-4 hidden sm:block" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab — Platform Overview + AI Usage Analytics */}
        <TabsContent value="dashboard" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Platform Overview */}
            <section className="space-y-4">
              <div className="mb-2">
                <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
                  Platform Overview
                </h3>
              </div>
              {statsLoading ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-[140px] animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  <HeroStatCard
                    icon={Users}
                    label="Total Users"
                    value={stats?.totalUsers ?? 0}
                    delta={stats?.newUsers7d ?? 0}
                    index={0}
                  />
                  <HeroStatCard
                    icon={FileText}
                    label="Total Entries"
                    value={stats?.totalEntries ?? 0}
                    delta={stats?.entriesCreated7d ?? 0}
                    index={1}
                  />
                  <HeroStatCard
                    icon={Bot}
                    label="AI Sessions"
                    value={stats?.totalAiSessions ?? 0}
                    delta={stats?.aiSessions7d ?? 0}
                    index={2}
                  />
                </div>
              )}

              {statsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-[56px] animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <CompactMetricStrip title="Users & Auth" items={userAuthMetrics} index={0} />
                  <CompactMetricStrip title="Workspaces" items={workspaceMetrics} index={1} />
                  <CompactMetricStrip title="Content" items={contentMetrics} index={2} />
                </div>
              )}
            </section>

            {/* AI Usage Analytics */}
            <section>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">
                  AI Usage Analytics
                </h3>
                <p className="text-xs text-foreground-muted mt-1">
                  Token consumption, cost breakdown, and usage trends across all AI operations.
                </p>
              </div>
              <AiUsageDashboard />
            </section>
          </motion.div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <UsersTable />
          </motion.div>
        </TabsContent>

        {/* AI Tab (AI Providers + AI Config) */}
        <TabsContent value="ai" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <AiTab
              aiSettings={settingsBySection['ai'] ?? []}
              configLoading={configLoading}
              configError={configError}
              onSaved={refreshRestartKeys}
            />
          </motion.div>
        </TabsContent>

        {/* Settings Tab (merged Authentication + Email + Application) */}
        <TabsContent value="settings" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <SettingsTab
              settingsBySection={settingsBySection}
              configLoading={configLoading}
              configError={configError}
              onSaved={refreshRestartKeys}
            />
          </motion.div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <LogsTab />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SuperDashboardPage;
