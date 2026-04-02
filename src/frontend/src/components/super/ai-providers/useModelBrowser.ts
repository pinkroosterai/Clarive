import { useMemo } from 'react';

import type { FetchedModelItem } from '@/services/api/aiProviderService';

export interface ModelGroup {
  provider: string;
  models: FetchedModelItem[];
}

export interface ModelFilters {
  reasoning: boolean;
  functionCalling: boolean;
  responseSchema: boolean;
}

function parseProvider(modelId: string): string {
  const slashIndex = modelId.indexOf('/');
  if (slashIndex === -1) return 'Other';
  const raw = modelId.substring(0, slashIndex);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function useModelBrowser(
  models: FetchedModelItem[],
  search: string,
  filters: ModelFilters
): { groups: ModelGroup[]; totalCount: number; filteredCount: number } {
  return useMemo(() => {
    // 1. Filter by capabilities (AND logic)
    let filtered = models;
    if (filters.reasoning) {
      filtered = filtered.filter((m) => m.isReasoning);
    }
    if (filters.functionCalling) {
      filtered = filtered.filter((m) => m.supportsFunctionCalling);
    }
    if (filters.responseSchema) {
      filtered = filtered.filter((m) => m.supportsResponseSchema);
    }

    // 2. Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((m) => m.modelId.toLowerCase().includes(q));
    }

    // 3. Group by provider origin
    const groupMap = new Map<string, FetchedModelItem[]>();
    for (const model of filtered) {
      const provider = parseProvider(model.modelId);
      const existing = groupMap.get(provider);
      if (existing) {
        existing.push(model);
      } else {
        groupMap.set(provider, [model]);
      }
    }

    // 4. Sort groups alphabetically, 'Other' last
    const groups: ModelGroup[] = Array.from(groupMap.entries())
      .sort(([a], [b]) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      })
      .map(([provider, groupModels]) => ({ provider, models: groupModels }));

    return {
      groups,
      totalCount: models.length,
      filteredCount: filtered.length,
    };
  }, [models, search, filters]);
}
