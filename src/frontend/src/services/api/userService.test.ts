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
}));

import { getUsersList, updateUserRole, removeUser, transferOwnership } from './userService';

import { api } from '@/services/api/apiClient';
import { createUser } from '@/test/factories';

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getUsersList ──

describe('getUsersList', () => {
  it('calls GET /api/users', async () => {
    const users = [createUser(), createUser({ email: 'second@test.com' })];
    mockApi.get.mockResolvedValue({ items: users });

    await getUsersList();

    expect(mockApi.get).toHaveBeenCalledWith('/api/users');
  });

  it('unwraps items from the response envelope', async () => {
    const user1 = createUser({ name: 'Alice' });
    const user2 = createUser({ name: 'Bob' });
    mockApi.get.mockResolvedValue({ items: [user1, user2] });

    const result = await getUsersList();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
  });

  it('returns empty array when no users exist', async () => {
    mockApi.get.mockResolvedValue({ items: [] });

    const result = await getUsersList();

    expect(result).toEqual([]);
  });
});

// ── updateUserRole ──

describe('updateUserRole', () => {
  it('calls PATCH /api/users/:id/role with new role', async () => {
    const user = createUser({ id: 'u1', role: 'editor' });
    mockApi.patch.mockResolvedValue(user);

    const result = await updateUserRole('u1', 'editor');

    expect(mockApi.patch).toHaveBeenCalledWith('/api/users/u1/role', {
      role: 'editor',
    });
    expect(result).toEqual(user);
  });

  it('returns updated user with new role', async () => {
    const user = createUser({ id: 'u1', role: 'admin' });
    mockApi.patch.mockResolvedValue(user);

    const result = await updateUserRole('u1', 'admin');

    expect(result.role).toBe('admin');
  });
});

// ── removeUser ──

describe('removeUser', () => {
  it('calls DELETE /api/users/:id', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await removeUser('u1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/users/u1');
  });
});

// ── transferOwnership ──

describe('transferOwnership', () => {
  it('calls POST /api/users/transfer-ownership with targetUserId and confirmation', async () => {
    const response = {
      previousAdmin: { id: 'u1', email: 'admin@test.com', role: 'editor' },
      newAdmin: { id: 'u2', email: 'new-admin@test.com', role: 'admin' },
    };
    mockApi.post.mockResolvedValue(response);

    const result = await transferOwnership('u2', 'TRANSFER OWNERSHIP');

    expect(mockApi.post).toHaveBeenCalledWith('/api/users/transfer-ownership', {
      targetUserId: 'u2',
      confirmation: 'TRANSFER OWNERSHIP',
    });
    expect(result.previousAdmin.id).toBe('u1');
    expect(result.previousAdmin.role).toBe('editor');
    expect(result.newAdmin.id).toBe('u2');
    expect(result.newAdmin.role).toBe('admin');
  });
});
