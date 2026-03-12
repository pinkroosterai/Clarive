import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  getSuperStats,
  getMaintenanceStatus,
  setMaintenanceMode,
  getSystemStatus,
  getSuperUsers,
  deleteSuperUser,
  resetUserPassword,
} from './superService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSuperStats', () => {
  it('calls GET /api/super/stats', async () => {
    const stats = { totalUsers: 100, totalEntries: 500 };
    mockApi.get.mockResolvedValue(stats);

    const result = await getSuperStats();

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/stats');
    expect(result).toEqual(stats);
  });
});

describe('getMaintenanceStatus', () => {
  it('calls GET /api/super/maintenance', async () => {
    mockApi.get.mockResolvedValue({ enabled: false });

    const result = await getMaintenanceStatus();

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/maintenance');
    expect(result.enabled).toBe(false);
  });
});

describe('setMaintenanceMode', () => {
  it('calls POST /api/super/maintenance with enabled flag', async () => {
    mockApi.post.mockResolvedValue({ enabled: true });

    const result = await setMaintenanceMode(true);

    expect(mockApi.post).toHaveBeenCalledWith('/api/super/maintenance', { enabled: true });
    expect(result.enabled).toBe(true);
  });
});

describe('getSystemStatus', () => {
  it('calls GET /api/status', async () => {
    const status = { maintenance: false, aiConfigured: true, webSearchAvailable: false };
    mockApi.get.mockResolvedValue(status);

    const result = await getSystemStatus();

    expect(mockApi.get).toHaveBeenCalledWith('/api/status');
    expect(result).toEqual(status);
  });
});

describe('getSuperUsers', () => {
  it('calls GET /api/super/users with query params', async () => {
    const response = { users: [], total: 0, page: 1, pageSize: 20 };
    mockApi.get.mockResolvedValue(response);

    const result = await getSuperUsers({ page: 1, pageSize: 20, search: 'john' });

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/users?page=1&pageSize=20&search=john');
    expect(result).toEqual(response);
  });

  it('omits empty params', async () => {
    mockApi.get.mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 20 });

    await getSuperUsers({});

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/users');
  });

  it('includes sortBy and sortDesc', async () => {
    mockApi.get.mockResolvedValue({ users: [], total: 0, page: 1, pageSize: 20 });

    await getSuperUsers({ sortBy: 'email', sortDesc: true });

    expect(mockApi.get).toHaveBeenCalledWith('/api/super/users?sortBy=email&sortDesc=true');
  });
});

describe('deleteSuperUser', () => {
  it('calls DELETE /api/super/users/{userId} with hard flag', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await deleteSuperUser('user-1', true);

    expect(mockApi.delete).toHaveBeenCalledWith('/api/super/users/user-1?hard=true');
  });

  it('soft deletes when hard is false', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await deleteSuperUser('user-1', false);

    expect(mockApi.delete).toHaveBeenCalledWith('/api/super/users/user-1?hard=false');
  });
});

describe('resetUserPassword', () => {
  it('calls POST /api/super/users/{userId}/reset-password', async () => {
    mockApi.post.mockResolvedValue({ newPassword: 'generated-pw' });

    const result = await resetUserPassword('user-1');

    expect(mockApi.post).toHaveBeenCalledWith('/api/super/users/user-1/reset-password');
    expect(result.newPassword).toBe('generated-pw');
  });
});
