import { useQuery } from '@tanstack/react-query';
import {
  getAiUsageFilters,
  getAiUsageLogs,
  getAiUsageStats,
  type AiUsageFilterParams,
} from '@/services/api/aiUsageService';

export function useAiUsageStats(filters: AiUsageFilterParams) {
  return useQuery({
    queryKey: ['super', 'ai-usage', 'stats', filters],
    queryFn: () => getAiUsageStats(filters),
    staleTime: 30_000,
  });
}

export function useAiUsageLogs(filters: AiUsageFilterParams, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['super', 'ai-usage', 'logs', filters, page, pageSize],
    queryFn: () => getAiUsageLogs(filters, page, pageSize),
    staleTime: 30_000,
  });
}

export function useAiUsageFilters(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['super', 'ai-usage', 'filters', dateFrom, dateTo],
    queryFn: () => getAiUsageFilters(dateFrom, dateTo),
    staleTime: 60_000,
  });
}
