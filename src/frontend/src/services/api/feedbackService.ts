import { api } from "./apiClient";

export interface FeedbackEntry {
  id: string;
  userName: string;
  userEmail: string;
  category: string;
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PaginatedFeedback {
  entries: FeedbackEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export async function submitFeedback(
  category: string,
  message: string,
  pageUrl: string,
): Promise<{ submitted: boolean }> {
  return api.post<{ submitted: boolean }>("/api/feedback", { category, message, pageUrl });
}

export async function getFeedbackList(page = 1, pageSize = 20): Promise<PaginatedFeedback> {
  return api.get<PaginatedFeedback>(`/api/super/feedback?page=${page}&pageSize=${pageSize}`);
}
