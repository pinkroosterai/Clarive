import { api, setToken, setRefreshToken } from './apiClient';

import type { AuthResponse, PendingWorkspaceInvitation, InvitationRespondResult } from '@/types';

export interface InvitationInfo {
  email: string;
  role: string;
  workspaceName: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export async function validateToken(token: string): Promise<InvitationInfo> {
  return api.get<InvitationInfo>(`/api/invitations/${encodeURIComponent(token)}/validate`);
}

export async function acceptInvitation(
  token: string,
  name: string,
  password: string
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>(`/api/invitations/${encodeURIComponent(token)}/accept`, {
    name,
    password,
  });
  setToken(res.token);
  setRefreshToken(res.refreshToken);
  return res;
}

export async function createInvitation(email: string, role: string): Promise<PendingInvitation> {
  return api.post<PendingInvitation>('/api/invitations', { email, role });
}

export async function resendInvitation(id: string): Promise<PendingInvitation> {
  return api.post<PendingInvitation>(`/api/invitations/${id}/resend`);
}

export async function revokeInvitation(id: string): Promise<void> {
  return api.delete(`/api/invitations/${id}`);
}

export async function getPendingInvitations(): Promise<PendingWorkspaceInvitation[]> {
  const res = await api.get<{ invitations: PendingWorkspaceInvitation[] }>(
    '/api/invitations/pending'
  );
  return res.invitations;
}

export async function getPendingCount(): Promise<number> {
  const res = await api.get<{ count: number }>('/api/invitations/pending/count');
  return res.count;
}

export async function respondToInvitation(
  id: string,
  accept: boolean
): Promise<InvitationRespondResult> {
  return api.post<InvitationRespondResult>(`/api/invitations/${id}/respond`, { accept });
}
