import { api } from './apiClient';

import type {
  ShareLinkInfo,
  ShareLinkCreated,
  CreateShareLinkRequest,
  SharedEntry,
} from '@/types/shareLink';

export async function createShareLink(
  entryId: string,
  request: CreateShareLinkRequest = {}
): Promise<ShareLinkCreated> {
  return api.post<ShareLinkCreated>(`/api/entries/${entryId}/share-link`, request);
}

export async function getShareLink(entryId: string): Promise<ShareLinkInfo> {
  return api.get<ShareLinkInfo>(`/api/entries/${entryId}/share-link`);
}

export async function revokeShareLink(entryId: string): Promise<void> {
  return api.delete(`/api/entries/${entryId}/share-link`);
}

export async function getPublicShare(token: string): Promise<SharedEntry> {
  return api.get<SharedEntry>(`/api/share/${encodeURIComponent(token)}`);
}

export async function verifySharePassword(token: string, password: string): Promise<SharedEntry> {
  return api.post<SharedEntry>(`/api/share/${encodeURIComponent(token)}/verify`, { password });
}
