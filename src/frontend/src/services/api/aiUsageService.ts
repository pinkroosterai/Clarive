import { api } from './apiClient';

// ── Types ──

export interface AiUsageLogEntry {
  id: string;
  tenantId: string;
  tenantName: string | null;
  userId: string;
  userEmail: string | null;
  actionType: string;
  model: string;
  provider: string;
  displayModel: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedInputCostUsd: number | null;
  estimatedOutputCostUsd: number | null;
  durationMs: number;
  entryId: string | null;
  createdAt: string;
}

export interface AiUsagePagedResponse {
  items: AiUsageLogEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface AiUsageTotals {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalEstimatedInputCostUsd: number;
  totalEstimatedOutputCostUsd: number;
  totalEstimatedCostUsd: number;
}

export interface AiUsageAverages {
  avgInputTokensPerRequest: number;
  avgOutputTokensPerRequest: number;
  avgTotalTokensPerRequest: number;
}

export interface AiUsageBreakdownItem {
  name: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  percentage: number;
  estimatedInputCostUsd: number;
  estimatedOutputCostUsd: number;
  estimatedCostUsd: number;
}

export interface AiUsageStatsResponse {
  totals: AiUsageTotals;
  averages: AiUsageAverages;
  byModel: AiUsageBreakdownItem[];
  byTenant: AiUsageBreakdownItem[];
  byUser: AiUsageBreakdownItem[];
  byActionType: AiUsageBreakdownItem[];
}

export interface AiUsageFilterParams {
  tenantIds?: string[];
  userId?: string;
  models?: string[];
  actionTypes?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface AiUsageFilterOptionsResponse {
  models: { id: string; displayName: string }[];
  actionTypes: string[];
  tenants: { id: string; name: string }[];
}

// ── API Functions ──

function buildQueryString(
  params: AiUsageFilterParams & {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDesc?: boolean;
  }
): string {
  const query = new URLSearchParams();
  if (params.tenantIds?.length) query.set('tenantId', params.tenantIds.join(','));
  if (params.userId) query.set('userId', params.userId);
  if (params.models?.length) query.set('model', params.models.join(','));
  if (params.actionTypes?.length) query.set('actionType', params.actionTypes.join(','));
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortDesc !== undefined) query.set('sortDesc', String(params.sortDesc));
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export async function getAiUsageLogs(
  filters: AiUsageFilterParams,
  page = 1,
  pageSize = 50,
  sortBy?: string,
  sortDesc?: boolean
): Promise<AiUsagePagedResponse> {
  return api.get<AiUsagePagedResponse>(
    `/api/super/ai-usage${buildQueryString({ ...filters, page, pageSize, sortBy, sortDesc })}`
  );
}

export async function getAiUsageStats(filters: AiUsageFilterParams): Promise<AiUsageStatsResponse> {
  return api.get<AiUsageStatsResponse>(`/api/super/ai-usage/stats${buildQueryString(filters)}`);
}

export async function getAiUsageFilters(
  dateFrom?: string,
  dateTo?: string
): Promise<AiUsageFilterOptionsResponse> {
  const query = new URLSearchParams();
  if (dateFrom) query.set('dateFrom', dateFrom);
  if (dateTo) query.set('dateTo', dateTo);
  const qs = query.toString();
  return api.get<AiUsageFilterOptionsResponse>(`/api/super/ai-usage/filters${qs ? `?${qs}` : ''}`);
}
