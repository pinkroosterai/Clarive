import type { Session, User } from "@/types";
import { api, getRefreshToken } from "./apiClient";

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  themePreference?: "light" | "dark" | "system";
}

export async function updateProfile(
  data: UpdateProfileRequest,
): Promise<User> {
  return api.patch<User>("/api/auth/profile", data);
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("avatar", file);
  return api.upload<{ avatarUrl: string }>("/api/profile/avatar", formData);
}

export async function deleteAvatar(): Promise<void> {
  await api.delete<void>("/api/profile/avatar");
}

export async function getSessions(): Promise<Session[]> {
  const refreshToken = getRefreshToken();
  const query = refreshToken
    ? `?currentRefreshToken=${encodeURIComponent(refreshToken)}`
    : "";
  return api.get<Session[]>(`/api/profile/sessions${query}`);
}

export async function revokeSession(sessionId: string): Promise<void> {
  await api.delete<void>(`/api/profile/sessions/${sessionId}`);
}

export async function revokeOtherSessions(): Promise<{ revoked: number }> {
  const refreshToken = getRefreshToken();
  const query = refreshToken
    ? `?currentRefreshToken=${encodeURIComponent(refreshToken)}`
    : "";
  return api.post<{ revoked: number }>(
    `/api/profile/sessions/revoke-others${query}`,
  );
}
