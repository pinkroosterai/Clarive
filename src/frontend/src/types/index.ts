export interface TemplateField {
  name: string;
  type: 'string' | 'int' | 'float' | 'enum';
  enumValues: string[];
  defaultValue: string | null;
  description: string | null;
  min: number | null;
  max: number | null;
}

export interface Prompt {
  id: string;
  content: string;
  order: number;
}

export interface PromptEntry {
  id: string;
  title: string;
  systemMessage: string | null;
  prompts: Prompt[];
  folderId: string | null;
  version: number;
  versionState: 'draft' | 'published' | 'historical';
  isTrashed: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Present only on list/summary responses — avoids fetching full prompts. */
  hasSystemMessage?: boolean;
  isTemplate?: boolean;
  isChain?: boolean;
  promptCount?: number;
  firstPromptPreview?: string | null;
  tags?: string[];
  isFavorited?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  children: Folder[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  emailVerified: boolean;
  onboardingCompleted: boolean;
  avatarUrl: string | null;
  hasPassword: boolean;
  isSuperUser: boolean;
  themePreference?: 'light' | 'dark' | 'system' | null;
  createdAt?: string;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'editor' | 'viewer';
  status: 'active' | 'pending';
  createdAt: string;
  expiresAt?: string | null;
}

export interface Session {
  id: string;
  ipAddress: string;
  browser: string;
  os: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface ToolDescription {
  id: string;
  name: string;
  toolName: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpImportResponse {
  imported: ToolDescription[];
  skippedCount: number;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  /** Only present immediately after creation — the full key cannot be retrieved again. */
  fullKey?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string | null;
}

export interface VersionInfo {
  version: number;
  versionState: 'draft' | 'published' | 'historical';
  publishedAt: string | null;
  publishedBy: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ProgressEvent {
  type: 'stage' | 'tool_start' | 'tool_end';
  id: string;
  icon?: string;
  message?: string;
  detail?: string;
}

export interface ProgressLogEntry {
  id: string;
  icon: string;
  message: string;
  detail?: string;
  completed: boolean;
  isStage: boolean;
  timestamp: number;
}

export interface ClarificationQuestion {
  text: string;
  suggestions: string[];
}

export interface EvaluationEntry {
  score: number;
  feedback: string;
}

export interface Evaluation {
  dimensions: Record<string, EvaluationEntry>;
}

export interface IterationScore {
  iteration: number;
  scores: Record<string, EvaluationEntry>;
  averageScore: number;
}

export interface Workspace {
  id: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  isPersonal: boolean;
  memberCount: number;
  avatarUrl: string | null;
}

export interface PendingWorkspaceInvitation {
  id: string;
  workspaceName: string;
  role: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface InvitationRespondResult {
  message: string;
  workspace?: Workspace;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
  workspaces?: Workspace[];
}

export interface TagSummary {
  name: string;
  entryCount: number;
}

export interface FavoriteEntry {
  id: string;
  title: string;
  versionState: 'draft' | 'published' | 'historical';
  favoritedAt: string;
}

export interface EntryActivityItem {
  id: string;
  action: string;
  userName: string;
  details: string | null;
  version: number | null;
  timestamp: string;
}

export interface EntryActivityResponse {
  items: EntryActivityItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardStats {
  totalEntries: number;
  publishedEntries: number;
  draftEntries: number;
  totalFolders: number;
  recentEntries: RecentEntry[];
  recentActivity: RecentActivity[];
  favoriteEntries: FavoriteEntry[];
}

export interface RecentEntry {
  id: string;
  title: string;
  versionState: 'draft' | 'published' | 'historical';
  updatedAt: string;
}

export interface RecentActivity {
  id: string;
  action: string;
  entityType: string;
  userName: string;
  details: string | null;
  timestamp: string;
}
