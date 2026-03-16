import { api } from './apiClient';

export type ConfigInputType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'select'
  | 'url'
  | 'toggle';

export interface ConfigVisibleWhen {
  key: string;
  values: string[];
}

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
  source: 'none' | 'default' | 'dashboard';
  inputType: ConfigInputType;
  selectOptions: string[] | null;
  subGroup: string | null;
  visibleWhen: ConfigVisibleWhen | null;
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
  return api.get<ConfigSetting[]>('/api/super/config');
}

export async function setConfigValue(key: string, value: string): Promise<SetConfigResult> {
  return api.put<SetConfigResult>(`/api/super/config/${encodeURIComponent(key)}`, { value });
}

export async function resetConfigValue(key: string): Promise<ResetConfigResult> {
  return api.delete<ResetConfigResult>(`/api/super/config/${encodeURIComponent(key)}`);
}

export interface SetupStatus {
  requiresSetup: boolean;
  unconfiguredSections: string[];
}

export async function getSetupStatus(): Promise<SetupStatus> {
  return api.get<SetupStatus>('/api/super/setup-status');
}
