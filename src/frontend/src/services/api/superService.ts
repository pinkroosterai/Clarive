import { api } from './apiClient';

export interface SuperStats {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  verifiedPct: number;
  onboardedPct: number;
  pendingDeletion: number;
  googleAuthUsers: number;
  totalWorkspaces: number;
  sharedWorkspaces: number;
  avgMembersPerWorkspace: number;
  pendingInvitations: number;
  invitationAcceptRate: number;
  totalEntries: number;
  publishedVersions: number;
  entriesCreated7d: number;
  trashedEntries: number;
  totalAiSessions: number;
  aiSessions7d: number;
  totalApiKeys: number;
}

export interface MaintenanceStatus {
  enabled: boolean;
}

export interface SystemStatus {
  maintenance: boolean;
  aiConfigured: boolean;
  webSearchAvailable: boolean;
}

export async function getSuperStats(): Promise<SuperStats> {
  return api.get<SuperStats>('/api/super/stats');
}

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  return api.get<MaintenanceStatus>('/api/super/maintenance');
}

export async function setMaintenanceMode(enabled: boolean): Promise<MaintenanceStatus> {
  return api.post<MaintenanceStatus>('/api/super/maintenance', { enabled });
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return api.get<SystemStatus>('/api/status');
}

// ── Super User Management ──

export interface SuperUserWorkspace {
  id: string;
  name: string;
  role: string;
}

export interface SuperUser {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  isGoogleAccount: boolean;
  isGitHubAccount: boolean;
  isSuperUser: boolean;
  avatarUrl: string | null;
  createdAt: string;
  deletedAt: string | null;
  workspaces: SuperUserWorkspace[];
}

export interface SuperUsersResponse {
  users: SuperUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ResetPasswordResponse {
  newPassword: string;
}

export async function getSuperUsers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  authType?: string;
  sortBy?: string;
  sortDesc?: boolean;
}): Promise<SuperUsersResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.authType) query.set('authType', params.authType);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortDesc !== undefined) query.set('sortDesc', String(params.sortDesc));
  const qs = query.toString();
  return api.get<SuperUsersResponse>(`/api/super/users${qs ? `?${qs}` : ''}`);
}

export async function deleteSuperUser(userId: string, hard: boolean): Promise<void> {
  await api.delete(`/api/super/users/${userId}?hard=${hard}`);
}

export async function resetUserPassword(userId: string): Promise<ResetPasswordResponse> {
  return api.post<ResetPasswordResponse>(`/api/super/users/${userId}/reset-password`);
}

// ── Create User ──

export interface WorkspaceAssignment {
  workspaceId: string;
  role: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  workspaces: WorkspaceAssignment[];
}

export interface CreateUserResponse {
  id: string;
  email: string;
  name: string;
  generatedPassword: string | null;
}

export async function createSuperUser(
  request: CreateUserRequest,
): Promise<CreateUserResponse> {
  return api.post<CreateUserResponse>('/api/super/users', request);
}

// ── Workspaces (for super admin dropdowns) ──

export interface SuperAdminWorkspace {
  id: string;
  name: string;
}

export async function getSuperWorkspaces(): Promise<SuperAdminWorkspace[]> {
  return api.get<SuperAdminWorkspace[]>('/api/super/workspaces');
}
