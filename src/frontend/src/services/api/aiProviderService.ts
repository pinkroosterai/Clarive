import { api } from './apiClient';

export interface AiProviderModelResponse {
  id: string;
  modelId: string;
  displayName: string | null;
  isReasoning: boolean;
  maxContextSize: number;
  isTemperatureConfigurable: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface AiProviderResponse {
  id: string;
  name: string;
  endpointUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  isKeyConfigured: boolean;
  models: AiProviderModelResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAiProviderRequest {
  name: string;
  endpointUrl?: string;
  apiKey: string;
}

export interface UpdateAiProviderRequest {
  name?: string;
  endpointUrl?: string;
  apiKey?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface AddModelRequest {
  modelId: string;
  displayName?: string;
  isReasoning?: boolean;
  maxContextSize?: number;
  isTemperatureConfigurable?: boolean;
}

export interface UpdateModelRequest {
  displayName?: string;
  isReasoning?: boolean;
  maxContextSize?: number;
  isTemperatureConfigurable?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

const BASE = '/api/super/ai-providers';

export async function getProviders(): Promise<AiProviderResponse[]> {
  return api.get<AiProviderResponse[]>(BASE);
}

export async function createProvider(req: CreateAiProviderRequest): Promise<AiProviderResponse> {
  return api.post<AiProviderResponse>(BASE, req);
}

export async function updateProvider(id: string, req: UpdateAiProviderRequest): Promise<AiProviderResponse> {
  return api.patch<AiProviderResponse>(`${BASE}/${id}`, req);
}

export async function deleteProvider(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export async function fetchModels(id: string): Promise<{ models: string[] }> {
  return api.post<{ models: string[] }>(`${BASE}/${id}/fetch-models`, {});
}

export async function validateProvider(id: string): Promise<{ valid: boolean }> {
  return api.post<{ valid: boolean }>(`${BASE}/${id}/validate`, {});
}

export async function addModel(providerId: string, req: AddModelRequest): Promise<AiProviderModelResponse> {
  return api.post<AiProviderModelResponse>(`${BASE}/${providerId}/models`, req);
}

export async function updateModel(
  providerId: string,
  modelId: string,
  req: UpdateModelRequest
): Promise<AiProviderModelResponse> {
  return api.patch<AiProviderModelResponse>(`${BASE}/${providerId}/models/${modelId}`, req);
}

export async function deleteModel(providerId: string, modelId: string): Promise<void> {
  await api.delete(`${BASE}/${providerId}/models/${modelId}`);
}
