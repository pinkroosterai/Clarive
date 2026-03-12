import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { getAuditLogPage } from './auditService';

import { api } from '@/services/api/apiClient';
import { createAuditLogEntry } from '@/test/factories';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAuditLogPage', () => {
  it('calls GET /api/audit-log with pagination params', async () => {
    const entry = createAuditLogEntry();
    mockApi.get.mockResolvedValue({ entries: [entry], total: 1, page: 1, pageSize: 20 });

    const result = await getAuditLogPage(1, 20);

    expect(mockApi.get).toHaveBeenCalledWith('/api/audit-log?page=1&pageSize=20');
    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('returns only entries and total (strips page/pageSize)', async () => {
    mockApi.get.mockResolvedValue({ entries: [], total: 0, page: 2, pageSize: 50 });

    const result = await getAuditLogPage(2, 50);

    expect(result).toEqual({ entries: [], total: 0 });
    expect(result).not.toHaveProperty('page');
    expect(result).not.toHaveProperty('pageSize');
  });
});
