import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api/apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
  },
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  getRefreshToken: vi.fn(),
}));

import { getMe, updateProfile, completeOnboarding } from './profileService';

import { api } from '@/services/api/apiClient';
import { createUser, createWorkspace } from '@/test/factories';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getMe ──

describe('getMe', () => {
  it('calls GET /api/profile/me and returns user', async () => {
    const user = createUser({ email: 'me@test.com' });
    mockApi.get.mockResolvedValue(user);

    const result = await getMe();

    expect(mockApi.get).toHaveBeenCalledWith('/api/profile/me');
    expect(result).toEqual(user);
  });

  it('returns user with workspaces when present', async () => {
    const workspaces = [
      createWorkspace({ name: 'Personal', isPersonal: true }),
      createWorkspace({ name: 'Team', isPersonal: false, role: 'editor' }),
    ];
    const userWithWorkspaces = { ...createUser({ email: 'me@test.com' }), workspaces };
    mockApi.get.mockResolvedValue(userWithWorkspaces);

    const result = await getMe();

    expect(result.workspaces).toHaveLength(2);
    expect(result.workspaces![0].name).toBe('Personal');
    expect(result.workspaces![1].role).toBe('editor');
  });
});

// ── updateProfile ──

describe('updateProfile', () => {
  it('calls PATCH /api/profile with data', async () => {
    const user = createUser({ name: 'Updated' });
    mockApi.patch.mockResolvedValue(user);

    const result = await updateProfile({ name: 'Updated' });

    expect(mockApi.patch).toHaveBeenCalledWith('/api/profile', { name: 'Updated' });
    expect(result).toEqual(user);
  });
});

// ── completeOnboarding ──

describe('completeOnboarding', () => {
  it('calls POST /api/profile/complete-onboarding', async () => {
    mockApi.post.mockResolvedValue(undefined);

    await completeOnboarding();

    expect(mockApi.post).toHaveBeenCalledWith('/api/profile/complete-onboarding');
  });
});
