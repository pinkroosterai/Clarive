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
  source: 'none' | 'environment' | 'dashboard';
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

// ── AI Config ──

export interface ValidateAiRequest {
  apiKey?: string;
  endpointUrl?: string;
}

export interface ValidateAiResponse {
  valid: boolean;
  error?: string;
}

export interface AiModelsResponse {
  models: string[];
}

export async function validateAiConfig(req: ValidateAiRequest): Promise<ValidateAiResponse> {
  return api.post<ValidateAiResponse>('/api/super/config/validate-ai', req);
}

export async function getAiModels(
  req: { apiKey?: string; endpointUrl?: string } = {}
): Promise<AiModelsResponse> {
  return api.post<AiModelsResponse>('/api/super/config/ai-models', req);
}
