import type {
  User,
  Folder,
  Prompt,
  PromptEntry,
  AuthResponse,
  Workspace,
  PendingWorkspaceInvitation,
  InvitationRespondResult,
  EvaluationEntry,
  Evaluation,
  ApiKey,
  AuditLogEntry,
  VersionInfo,
} from '@/types';

let counter = 0;
function uid(): string {
  return `test-${++counter}`;
}

// ── Users ──

export function createUser(overrides?: Partial<User>): User {
  return {
    id: uid(),
    email: 'user@test.com',
    name: 'Test User',
    role: 'editor',
    emailVerified: true,
    onboardingCompleted: true,
    avatarUrl: null,
    hasPassword: true,
    isSuperUser: false,
    themePreference: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Folders ──

export function createFolder(overrides?: Partial<Folder>): Folder {
  return {
    id: uid(),
    name: 'Test Folder',
    parentId: null,
    color: null,
    children: [],
    ...overrides,
  };
}

export function createFolderTree(): Folder[] {
  const grandchild = createFolder({ name: 'Grandchild' });
  const child1 = createFolder({ name: 'Child 1', children: [grandchild] });
  const child2 = createFolder({ name: 'Child 2' });
  const root = createFolder({ name: 'Root Folder', children: [child1, child2] });
  // Fix parent IDs
  child1.parentId = root.id;
  child2.parentId = root.id;
  grandchild.parentId = child1.id;
  return [root];
}

// ── Prompts & Entries ──

export function createPrompt(overrides?: Partial<Prompt>): Prompt {
  return {
    id: uid(),
    content: 'You are a helpful assistant. Please {{task|string}}.',
    order: 0,
    ...overrides,
  };
}

export function createEntry(overrides?: Partial<PromptEntry>): PromptEntry {
  return {
    id: uid(),
    title: 'Test Entry',
    systemMessage: null,
    prompts: [createPrompt()],
    folderId: null,
    version: 1,
    versionState: 'tab',
    isTrashed: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user@test.com',
    ...overrides,
  };
}

export function createDraftEntry(overrides?: Partial<PromptEntry>): PromptEntry {
  return createEntry({ versionState: 'tab', version: 1, ...overrides });
}

export function createPublishedEntry(overrides?: Partial<PromptEntry>): PromptEntry {
  return createEntry({ versionState: 'published', version: 2, ...overrides });
}

// ── Workspaces ──

export function createWorkspace(overrides?: Partial<Workspace>): Workspace {
  return {
    id: uid(),
    name: 'Test Workspace',
    role: 'admin',
    isPersonal: true,
    memberCount: 1,
    avatarUrl: null,
    ...overrides,
  };
}

// ── Pending Invitations ──

export function createPendingWorkspaceInvitation(
  overrides?: Partial<PendingWorkspaceInvitation>
): PendingWorkspaceInvitation {
  return {
    id: uid(),
    workspaceName: 'Acme Corp',
    role: 'editor',
    invitedBy: 'Admin User',
    createdAt: '2026-03-04T00:00:00Z',
    expiresAt: '2026-03-11T00:00:00Z',
    ...overrides,
  };
}

export function createInvitationRespondResult(
  overrides?: Partial<InvitationRespondResult>
): InvitationRespondResult {
  return {
    message: 'You have joined Acme Corp',
    workspace: createWorkspace({ name: 'Acme Corp', isPersonal: false, role: 'editor' }),
    ...overrides,
  };
}

// ── Auth ──

export function createAuthResponse(overrides?: Partial<AuthResponse>): AuthResponse {
  return {
    token: 'test-jwt-token',
    refreshToken: 'test-refresh-token',
    user: createUser(),
    ...overrides,
  };
}

// ── API Keys ──

export function createApiKey(overrides?: Partial<ApiKey>): ApiKey {
  return {
    id: uid(),
    name: 'Test Key',
    keyPrefix: 'cl_abc1',
    createdAt: '2026-01-01T00:00:00Z',
    expiresAt: null,
    lastUsedAt: null,
    usageCount: 0,
    isExpired: false,
    ...overrides,
  };
}

// ── Audit Log ──

export function createAuditLogEntry(overrides?: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: uid(),
    action: 'entry_create',
    entityType: 'PromptEntry',
    entityId: uid(),
    userId: uid(),
    userName: 'Test User',
    timestamp: '2026-01-01T00:00:00Z',
    details: null,
    ...overrides,
  };
}

// ── Versions ──

export function createVersionInfo(overrides?: Partial<VersionInfo>): VersionInfo {
  return {
    id: uid(),
    version: 1,
    versionState: 'tab',
    publishedAt: null,
    publishedBy: null,
    ...overrides,
  };
}

// ── AI / Wizard ──

function createEvaluationEntry(overrides?: Partial<EvaluationEntry>): EvaluationEntry {
  return {
    score: 8,
    feedback: 'Well structured prompt.',
    ...overrides,
  };
}

export function createEvaluation(overrides?: Partial<Evaluation>): Evaluation {
  return {
    dimensions: {
      Clarity: createEvaluationEntry({ score: 8, feedback: 'Clear and concise.' }),
      Effectiveness: createEvaluationEntry({
        score: 8,
        feedback: 'Well structured and practical.',
      }),
      Completeness: createEvaluationEntry({ score: 6, feedback: 'Missing edge cases.' }),
      Faithfulness: createEvaluationEntry({ score: 9, feedback: 'Stays on topic.' }),
    },
    ...overrides,
  };
}

