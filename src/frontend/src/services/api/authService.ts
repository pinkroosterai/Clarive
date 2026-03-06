import type { AuthResponse, User, Workspace } from "@/types";
import { api, setToken, setRefreshToken, getRefreshToken } from "./apiClient";

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/api/auth/login", {
    email,
    password,
  });
  setToken(res.token);
  setRefreshToken(res.refreshToken);
  return res;
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/api/auth/register", {
    email,
    password,
    name,
  });
  setToken(res.token);
  setRefreshToken(res.refreshToken);
  return res;
}

export async function googleAuth(
  idToken: string,
): Promise<AuthResponse & { isNewUser: boolean }> {
  const res = await api.post<AuthResponse & { isNewUser: boolean }>(
    "/api/auth/google",
    { idToken },
  );
  setToken(res.token);
  setRefreshToken(res.refreshToken);
  return res;
}

export async function refreshTokens(): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>("/api/auth/refresh", {
    refreshToken: getRefreshToken() ?? "",
  });
  setToken(res.token);
  setRefreshToken(res.refreshToken);
  return res;
}

export async function getMe(): Promise<User & { workspaces?: Workspace[] }> {
  return api.get<User & { workspaces?: Workspace[] }>("/api/auth/me");
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post<void>("/api/auth/verify-email", { token });
}

export async function resendVerification(): Promise<void> {
  await api.post<void>("/api/auth/resend-verification");
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post<void>("/api/auth/forgot-password", { email });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post<void>("/api/auth/reset-password", { token, newPassword });
}

export async function completeOnboarding(): Promise<void> {
  await api.post<void>("/api/auth/complete-onboarding");
}

export async function deleteAccount(confirmation: string): Promise<void> {
  await api.post<void>("/api/account/delete", { confirmation });
}

export async function cancelDeletion(): Promise<void> {
  await api.post<void>("/api/account/cancel-deletion");
}

export async function getSetupStatus(): Promise<{ isSetupComplete: boolean; allowRegistration: boolean }> {
  return api.get<{ isSetupComplete: boolean; allowRegistration: boolean }>("/api/auth/setup-status");
}
