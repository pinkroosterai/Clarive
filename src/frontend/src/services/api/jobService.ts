import { api } from './apiClient';

export interface JobSummary {
  name: string;
  group: string;
  cronExpression: string | null;
  triggerState: string;
  lastRunUtc: string | null;
  nextFireTimeUtc: string | null;
  lastDurationMs: number | null;
  lastSucceeded: boolean | null;
}

export interface JobHistoryItem {
  fireTimeUtc: string;
  startedAtUtc: string;
  finishedAtUtc: string | null;
  durationMs: number | null;
  succeeded: boolean;
  exceptionMessage: string | null;
}

export interface JobHistoryPagedResponse {
  items: JobHistoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function getJobs(): Promise<JobSummary[]> {
  return api.get<JobSummary[]>('/api/super/jobs');
}

export async function getJobHistory(
  name: string,
  page: number = 1,
  pageSize: number = 20
): Promise<JobHistoryPagedResponse> {
  return api.get<JobHistoryPagedResponse>(
    `/api/super/jobs/${encodeURIComponent(name)}/history?page=${page}&pageSize=${pageSize}`
  );
}

export async function triggerJob(name: string): Promise<void> {
  await api.post(`/api/super/jobs/${encodeURIComponent(name)}/trigger`);
}

export async function pauseJob(name: string): Promise<void> {
  await api.post(`/api/super/jobs/${encodeURIComponent(name)}/pause`);
}

export async function resumeJob(name: string): Promise<void> {
  await api.post(`/api/super/jobs/${encodeURIComponent(name)}/resume`);
}

export async function updateJobSchedule(
  name: string,
  cronExpression: string
): Promise<{ cronExpression: string; nextFireTimeUtc: string | null }> {
  return api.put(`/api/super/jobs/${encodeURIComponent(name)}/schedule`, {
    cronExpression,
  });
}
