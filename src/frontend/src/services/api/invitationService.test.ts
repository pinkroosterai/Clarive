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

import {
  validateToken,
  acceptInvitation,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  getPendingInvitations,
  getPendingCount,
  respondToInvitation,
} from './invitationService';

import { api, setToken, setRefreshToken } from '@/services/api/apiClient';
import {
  createAuthResponse,
  createWorkspace,
  createPendingWorkspaceInvitation,
  createInvitationRespondResult,
} from '@/test/factories';

const mockApi = vi.mocked(api);
const mockSetToken = vi.mocked(setToken);
const mockSetRefreshToken = vi.mocked(setRefreshToken);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── validateToken ──

describe('validateToken', () => {
  it('calls GET /api/invitations/{token}/validate', async () => {
    const info = { email: 'user@test.com', role: 'editor', workspaceName: 'Acme' };
    mockApi.get.mockResolvedValue(info);

    const result = await validateToken('inv_abc123');

    expect(mockApi.get).toHaveBeenCalledWith('/api/invitations/inv_abc123/validate');
    expect(result).toEqual(info);
  });

  it('encodes token in URL', async () => {
    mockApi.get.mockResolvedValue({ email: 'a@b.com', role: 'viewer', workspaceName: 'W' });

    await validateToken('inv_token+with/special=chars');

    expect(mockApi.get).toHaveBeenCalledWith(
      `/api/invitations/${encodeURIComponent('inv_token+with/special=chars')}/validate`
    );
  });
});

// ── acceptInvitation ──

describe('acceptInvitation', () => {
  it('calls POST /api/invitations/{token}/accept with name and password', async () => {
    const authResponse = createAuthResponse();
    mockApi.post.mockResolvedValue(authResponse);

    const result = await acceptInvitation('inv_abc123', 'Jane Doe', 'securepass123');

    expect(mockApi.post).toHaveBeenCalledWith('/api/invitations/inv_abc123/accept', {
      name: 'Jane Doe',
      password: 'securepass123',
    });
    expect(result).toEqual(authResponse);
  });

  it('sets access token after successful accept', async () => {
    const authResponse = createAuthResponse({
      token: 'new-jwt',
      refreshToken: 'new-refresh',
    });
    mockApi.post.mockResolvedValue(authResponse);

    await acceptInvitation('inv_abc123', 'Jane', 'password123');

    expect(mockSetToken).toHaveBeenCalledWith('new-jwt');
  });

  it('sets refresh token after successful accept', async () => {
    const authResponse = createAuthResponse({
      token: 'new-jwt',
      refreshToken: 'new-refresh',
    });
    mockApi.post.mockResolvedValue(authResponse);

    await acceptInvitation('inv_abc123', 'Jane', 'password123');

    expect(mockSetRefreshToken).toHaveBeenCalledWith('new-refresh');
  });

  it('encodes token in URL', async () => {
    mockApi.post.mockResolvedValue(createAuthResponse());

    await acceptInvitation('inv_special+token', 'Name', 'pass');

    expect(mockApi.post).toHaveBeenCalledWith(
      `/api/invitations/${encodeURIComponent('inv_special+token')}/accept`,
      { name: 'Name', password: 'pass' }
    );
  });

  it('returns workspaces when included in response', async () => {
    const workspaces = [
      createWorkspace({ name: 'Personal', isPersonal: true }),
      createWorkspace({ name: 'Invited Team', isPersonal: false, role: 'editor' }),
    ];
    const authResponse = createAuthResponse({ workspaces });
    mockApi.post.mockResolvedValue(authResponse);

    const result = await acceptInvitation('inv_abc', 'Jane', 'pass');

    expect(result.workspaces).toHaveLength(2);
    expect(result.workspaces![0].isPersonal).toBe(true);
    expect(result.workspaces![1].name).toBe('Invited Team');
  });
});

// ── createInvitation ──

describe('createInvitation', () => {
  it('calls POST /api/invitations with email and role', async () => {
    const pending = {
      id: 'inv-1',
      email: 'new@test.com',
      role: 'editor',
      expiresAt: '2026-03-10T00:00:00Z',
      createdAt: '2026-03-03T00:00:00Z',
    };
    mockApi.post.mockResolvedValue(pending);

    const result = await createInvitation('new@test.com', 'editor');

    expect(mockApi.post).toHaveBeenCalledWith('/api/invitations', {
      email: 'new@test.com',
      role: 'editor',
    });
    expect(result).toEqual(pending);
  });

  it('supports viewer role', async () => {
    const pending = {
      id: 'inv-2',
      email: 'viewer@test.com',
      role: 'viewer',
      expiresAt: '2026-03-10T00:00:00Z',
      createdAt: '2026-03-03T00:00:00Z',
    };
    mockApi.post.mockResolvedValue(pending);

    const result = await createInvitation('viewer@test.com', 'viewer');

    expect(result.role).toBe('viewer');
  });
});

// ── resendInvitation ──

describe('resendInvitation', () => {
  it('calls POST /api/invitations/{id}/resend', async () => {
    const updated = {
      id: 'inv-1',
      email: 'user@test.com',
      role: 'editor',
      expiresAt: '2026-03-17T00:00:00Z',
      createdAt: '2026-03-03T00:00:00Z',
    };
    mockApi.post.mockResolvedValue(updated);

    const result = await resendInvitation('inv-1');

    expect(mockApi.post).toHaveBeenCalledWith('/api/invitations/inv-1/resend');
    expect(result).toEqual(updated);
  });
});

// ── revokeInvitation ──

describe('revokeInvitation', () => {
  it('calls DELETE /api/invitations/{id}', async () => {
    mockApi.delete.mockResolvedValue(undefined);

    await revokeInvitation('inv-1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/invitations/inv-1');
  });
});

// ── getPendingInvitations ──

describe('getPendingInvitations', () => {
  it('calls GET /api/invitations/pending and returns invitations array', async () => {
    const invitations = [
      createPendingWorkspaceInvitation({ workspaceName: 'Acme' }),
      createPendingWorkspaceInvitation({ workspaceName: 'Beta Corp' }),
    ];
    mockApi.get.mockResolvedValue({ invitations });

    const result = await getPendingInvitations();

    expect(mockApi.get).toHaveBeenCalledWith('/api/invitations/pending');
    expect(result).toHaveLength(2);
    expect(result[0].workspaceName).toBe('Acme');
    expect(result[1].workspaceName).toBe('Beta Corp');
  });

  it('returns empty array when no pending invitations', async () => {
    mockApi.get.mockResolvedValue({ invitations: [] });

    const result = await getPendingInvitations();

    expect(result).toHaveLength(0);
  });
});

// ── getPendingCount ──

describe('getPendingCount', () => {
  it('calls GET /api/invitations/pending/count and returns count', async () => {
    mockApi.get.mockResolvedValue({ count: 3 });

    const result = await getPendingCount();

    expect(mockApi.get).toHaveBeenCalledWith('/api/invitations/pending/count');
    expect(result).toBe(3);
  });

  it('returns 0 when no pending invitations', async () => {
    mockApi.get.mockResolvedValue({ count: 0 });

    const result = await getPendingCount();

    expect(result).toBe(0);
  });
});

// ── respondToInvitation ──

describe('respondToInvitation', () => {
  it('calls POST /api/invitations/{id}/respond with accept=true', async () => {
    const result = createInvitationRespondResult();
    mockApi.post.mockResolvedValue(result);

    const response = await respondToInvitation('inv-1', true);

    expect(mockApi.post).toHaveBeenCalledWith('/api/invitations/inv-1/respond', { accept: true });
    expect(response.message).toContain('joined');
    expect(response.workspace).toBeDefined();
    expect(response.workspace!.role).toBe('editor');
  });

  it('calls POST /api/invitations/{id}/respond with accept=false', async () => {
    const result = createInvitationRespondResult({
      message: 'Invitation declined',
      workspace: undefined,
    });
    mockApi.post.mockResolvedValue(result);

    const response = await respondToInvitation('inv-1', false);

    expect(mockApi.post).toHaveBeenCalledWith('/api/invitations/inv-1/respond', { accept: false });
    expect(response.message).toContain('declined');
    expect(response.workspace).toBeUndefined();
  });
});
