import { useQuery } from '@tanstack/react-query';
import {
  getSystemLogs,
  type SystemLogFilterParams,
} from '@/services/api/systemLogService';

export function useSystemLogs(
  filters: SystemLogFilterParams,
  page = 1,
  pageSize = 50,
  sortBy?: string,
  sortDesc?: boolean,
) {
  return useQuery({
    queryKey: ['super', 'system-logs', filters, page, pageSize, sortBy, sortDesc],
    queryFn: () => getSystemLogs(filters, page, pageSize, sortBy, sortDesc),
    staleTime: 30_000,
  });
}
