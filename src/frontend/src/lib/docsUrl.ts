const DOCS_BASE = 'https://docs.clarive.app';

const sectionToPath: Record<string, string> = {
  'getting-started': '/getting-started',
  'entry-editor': '/editor',
  'tabs-and-versions': '/editor/tabs-versions-publishing',
  'tools': '/team-workspace/tools-mcp',
  'ai-wizard': '/ai/ai-wizard',
  'playground': '/ai/playground',
  'library': '/content-organization/library-search',
  'folders': '/content-organization/folders',
  'trash': '/content-organization/trash-recovery',
  'share-links': '/content-organization/share-links',
  'workspaces': '/team-workspace/workspaces-teams',
  'account-settings': '/account/profile-security',
  'import-export': '/content-organization/import-export',
  'api-keys': '/api-reference/api-keys',
  'audit-log': '/team-workspace/audit-log',
  'super-admin': '/administration/super-admin',
};

export function getDocsUrl(section?: string): string {
  if (!section) return DOCS_BASE;
  return `${DOCS_BASE}${sectionToPath[section] ?? ''}`;
}
