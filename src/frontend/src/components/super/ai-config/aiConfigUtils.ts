import type { AiProviderResponse } from '@/services/api/aiProviderService';
import type { ConfigSetting } from '@/services/api/configService';

export interface ProviderModel {
  providerId: string;
  providerName: string;
  modelId: string;
}

export function findSetting(settings: ConfigSetting[], key: string): ConfigSetting | undefined {
  return settings.find((s) => s.key === key);
}

export function buildProviderModels(providers: AiProviderResponse[] | undefined): ProviderModel[] {
  if (!providers) return [];
  return providers
    .filter((p) => p.isActive)
    .flatMap((p) =>
      p.models
        .filter((m) => m.isActive)
        .map((m) => ({ providerId: p.id, providerName: p.name, modelId: m.modelId }))
    );
}

export function groupByProvider(models: ProviderModel[]): Record<string, ProviderModel[]> {
  return models.reduce<Record<string, ProviderModel[]>>((acc, m) => {
    (acc[m.providerName] ??= []).push(m);
    return acc;
  }, {});
}

export function findModelMetadata(
  providers: AiProviderResponse[] | undefined,
  modelId: string,
  providerId: string
) {
  if (!providers || !modelId || !providerId) return null;
  for (const p of providers) {
    if (p.id !== providerId) continue;
    const model = p.models.find((m) => m.modelId === modelId);
    if (model) return model;
  }
  return null;
}
