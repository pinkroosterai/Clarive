import type { AuditLogEntry } from "@/types";
import { api } from "./apiClient";

export async function getAuditLogPage(
  page: number,
  pageSize: number,
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const res = await api.get<{
    entries: AuditLogEntry[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/api/audit-log?page=${page}&pageSize=${pageSize}`);

  return { entries: res.entries, total: res.total };
}
