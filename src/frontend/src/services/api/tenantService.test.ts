import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
  },
}));

import {
  getTenant,
  updateTenantName,
  uploadWorkspaceAvatar,
  deleteWorkspaceAvatar,
} from './tenantService';

import { api } from '@/services/api/apiClient';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getTenant', () => {
  it('calls GET /api/tenant', async () => {
    const tenant = { id: 't-1', name: 'My Workspace', avatarUrl: null };
    mockApi.get.mockResolvedValue(tenant);

    const result = await getTenant();

    expect(mockApi.get).toHaveBeenCalledWith('/api/tenant');
    expect(result).toEqual(tenant);
  });
});

describe('updateTenantName', () => {
  it('calls PATCH /api/tenant with name', async () => {
    const tenant = { id: 't-1', name: 'Renamed', avatarUrl: null };
    mockApi.patch.mockResolvedValue(tenant);

    const result = await updateTenantName('Renamed');

    expect(mockApi.patch).toHaveBeenCalledWith('/api/tenant', { name: 'Renamed' });
    expect(result.name).toBe('Renamed');
  });
});

describe('uploadWorkspaceAvatar', () => {
  it('calls upload /api/tenant/avatar with form data', async () => {
    const response = { avatarUrl: '/avatars/abc.png' };
    mockApi.upload.mockResolvedValue(response);

    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    const result = await uploadWorkspaceAvatar(file);

    expect(mockApi.upload).toHaveBeenCalledWith('/api/tenant/avatar', expect.any(FormData));
    expect(result.avatarUrl).toBe('/avatars/abc.png');
  });
});

describe('deleteWorkspaceAvatar', () => {
  it('calls DELETE /api/tenant/avatar', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await deleteWorkspaceAvatar();

    expect(mockApi.delete).toHaveBeenCalledWith('/api/tenant/avatar');
  });
});
