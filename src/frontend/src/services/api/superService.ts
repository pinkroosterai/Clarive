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
