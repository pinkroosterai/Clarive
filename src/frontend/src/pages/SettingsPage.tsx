import { useQuery } from '@tanstack/react-query';
import { Users, Key, ScrollText, ArrowLeftRight, UserCircle, Wrench } from 'lucide-react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import AccountDeletionSection from '@/components/settings/AccountDeletionSection';
import ApiKeyPanel from '@/components/settings/ApiKeyPanel';
import AuditLogTable from '@/components/settings/AuditLogTable';
import ImportExportPanel from '@/components/settings/ImportExportPanel';
import ProfileSection from '@/components/settings/ProfileSection';
import SessionManager from '@/components/settings/SessionManager';
import UserManagement from '@/components/settings/UserManagement';
import WorkspaceSection from '@/components/settings/WorkspaceSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ToolsPanel from '@/pages/ToolsPage';
import { userService, apiKeyService, auditService } from '@/services';

function TabCount({ count }: { count: number | undefined }) {
  if (count === undefined) return null;
  return <span className="ml-1 text-xs text-foreground-muted font-normal">({count})</span>;
}

const TAB_STYLE =
  'gap-1.5 min-h-[44px] text-foreground-muted hover:text-foreground-secondary data-[state=active]:bg-surface data-[state=active]:elevation-1 data-[state=active]:rounded-md data-[state=active]:text-foreground';

const VALID_TABS = ['profile', 'users', 'api-keys', 'tools', 'audit-log', 'import-export'];

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const activeTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'profile';

  useEffect(() => {
    document.title = 'Clarive — Settings';
  }, []);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: userService.getUsersList,
  });
  const { data: apiKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: apiKeyService.getApiKeysList,
  });
  const { data: auditData } = useQuery({
    queryKey: ['auditLog', 1],
    queryFn: () => auditService.getAuditLogPage(1, 20),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setSearchParams({ tab }, { replace: true })}
        className="w-full"
      >
        <TabsList className="w-full h-auto justify-start flex-wrap bg-elevated rounded-lg p-1">
          <TabsTrigger value="profile" className={TAB_STYLE}>
            <UserCircle className="size-4 hidden sm:block" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="users" className={TAB_STYLE}>
            <Users className="size-4 hidden sm:block" />
            Users
            <TabCount count={users?.length} />
          </TabsTrigger>
          <TabsTrigger value="api-keys" className={TAB_STYLE}>
            <Key className="size-4 hidden sm:block" />
            API Keys
            <TabCount count={apiKeys?.length} />
          </TabsTrigger>
          <TabsTrigger value="tools" className={TAB_STYLE}>
            <Wrench className="size-4 hidden sm:block" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="audit-log" className={TAB_STYLE}>
            <ScrollText className="size-4 hidden sm:block" />
            Audit Log
            <TabCount count={auditData?.total} />
          </TabsTrigger>
          <TabsTrigger value="import-export" className={TAB_STYLE}>
            <ArrowLeftRight className="size-4 hidden sm:block" />
            Import/Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="space-y-8">
            <ProfileSection />
            <SessionManager />
            <AccountDeletionSection />
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="space-y-6">
            <WorkspaceSection />
            <UserManagement />
          </div>
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeyPanel />
        </TabsContent>

        <TabsContent value="tools">
          <ToolsPanel />
        </TabsContent>

        <TabsContent value="audit-log">
          <AuditLogTable />
        </TabsContent>

        <TabsContent value="import-export">
          <ImportExportPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
