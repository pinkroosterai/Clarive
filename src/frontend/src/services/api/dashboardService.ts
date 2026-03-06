import { api } from './apiClient';

import type { DashboardStats } from '@/types';

export async function getStats(): Promise<DashboardStats> {
  return api.get<DashboardStats>('/api/dashboard/stats');
}
