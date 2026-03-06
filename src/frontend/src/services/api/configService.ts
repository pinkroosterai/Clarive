import { api } from "./apiClient";

export interface ConfigSetting {
  key: string;
  label: string;
  description: string;
  section: string;
  isSecret: boolean;
  requiresRestart: boolean;
  validationHint: string | null;
  value: string | null;
  isOverridden: boolean;
  isConfigured: boolean;
  source: "none" | "environment" | "dashboard";
}

export interface SetConfigResult {
  key: string;
  updated: boolean;
  requiresRestart: boolean;
}

export interface ResetConfigResult {
  key: string;
  reset: boolean;
}

export async function getAllConfig(): Promise<ConfigSetting[]> {
  return api.get<ConfigSetting[]>("/api/super/config");
}

export async function setConfigValue(key: string, value: string): Promise<SetConfigResult> {
  return api.put<SetConfigResult>(`/api/super/config/${encodeURIComponent(key)}`, { value });
}

export async function resetConfigValue(key: string): Promise<ResetConfigResult> {
  return api.delete<ResetConfigResult>(`/api/super/config/${encodeURIComponent(key)}`);
}
