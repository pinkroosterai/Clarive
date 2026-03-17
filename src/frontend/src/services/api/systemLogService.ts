import { api } from './apiClient';

// ── Types ──

export interface SystemLogEntry {
  id: number;
  timestamp: string;
  level: string;
  sourceContext: string | null;
  message: string;
  exception: string | null;
  properties: string | null;
}

export interface SystemLogPagedResponse {
  items: SystemLogEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface SystemLogFilterParams {
  levels?: string[];
  source?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── API Functions ──

function buildQueryString(
  params: SystemLogFilterParams & {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDesc?: boolean;
  }
): string {
  const query = new URLSearchParams();
  if (params.levels?.length) query.set('levels', params.levels.join(','));
  if (params.source) query.set('source', params.source);
  if (params.search) query.set('search', params.search);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortDesc !== undefined) query.set('sortDesc', String(params.sortDesc));
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export async function getSystemLogs(
  filters: SystemLogFilterParams,
  page = 1,
  pageSize = 50,
  sortBy?: string,
  sortDesc?: boolean
): Promise<SystemLogPagedResponse> {
  return api.get<SystemLogPagedResponse>(
    `/api/super/system-logs${buildQueryString({ ...filters, page, pageSize, sortBy, sortDesc })}`
  );
}
