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

import {
  login,
  register,
  googleAuth,
  refreshTokens,
  getMe,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  deleteAccount,
  cancelDeletion,
} from './authService';

import { api, setToken, setRefreshToken, getRefreshToken } from '@/services/api/apiClient';
import { createAuthResponse, createUser, createWorkspace } from '@/test/factories';

const mockApi = vi.mocked(api);
const mockSetToken = vi.mocked(setToken);
const mockSetRefreshToken = vi.mocked(setRefreshToken);
const mockGetRefreshToken = vi.mocked(getRefreshToken);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── login ──

describe('login', () => {
  it('calls POST /api/auth/login with email and password', async () => {
    const authRes = createAuthResponse();
    mockApi.post.mockResolvedValue(authRes);

    const result = await login('user@test.com', 'password123');

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'user@test.com',
      password: 'password123',
    });
    expect(result).toEqual(authRes);
  });

  it('sets token and refreshToken after login', async () => {
    const authRes = createAuthResponse({
      token: 'jwt-abc',
      refreshToken: 'refresh-xyz',
    });
    mockApi.post.mockResolvedValue(authRes);

    await login('user@test.com', 'pass');

    expect(mockSetToken).toHaveBeenCalledWith('jwt-abc');
    expect(mockSetRefreshToken).toHaveBeenCalledWith('refresh-xyz');
  });
});

// ── register ──

describe('register', () => {
  it('calls POST /api/auth/register with email, password, and name', async () => {
    const authRes = createAuthResponse();
    mockApi.post.mockResolvedValue(authRes);

    const result = await register('new@test.com', 'password123', 'New User');

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'new@test.com',
      password: 'password123',
      name: 'New User',
    });
    expect(result).toEqual(authRes);
  });

  it('sets token and refreshToken after register', async () => {
    const authRes = createAuthResponse({
      token: 'new-jwt',
      refreshToken: 'new-refresh',
    });
    mockApi.post.mockResolvedValue(authRes);

    await register('new@test.com', 'pass', 'Name');

    expect(mockSetToken).toHaveBeenCalledWith('new-jwt');
    expect(mockSetRefreshToken).toHaveBeenCalledWith('new-refresh');
  });
});

// ── googleAuth ──

describe('googleAuth', () => {
  it('calls POST /api/auth/google with idToken', async () => {
    const authRes = { ...createAuthResponse(), isNewUser: true };
    mockApi.post.mockResolvedValue(authRes);

    const result = await googleAuth('google-id-token-abc');

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/google', {
      idToken: 'google-id-token-abc',
    });
    expect(result.isNewUser).toBe(true);
  });

  it('sets token and refreshToken after google auth', async () => {
    const authRes = {
      ...createAuthResponse({ token: 'g-jwt', refreshToken: 'g-refresh' }),
      isNewUser: false,
    };
    mockApi.post.mockResolvedValue(authRes);

    await googleAuth('token');

    expect(mockSetToken).toHaveBeenCalledWith('g-jwt');
    expect(mockSetRefreshToken).toHaveBeenCalledWith('g-refresh');
  });
});

// ── refreshTokens ──

describe('refreshTokens', () => {
  it('calls POST /api/auth/refresh with current refresh token', async () => {
    mockGetRefreshToken.mockReturnValue('current-refresh');
    const authRes = createAuthResponse({
      token: 'new-jwt',
      refreshToken: 'new-refresh',
    });
    mockApi.post.mockResolvedValue(authRes);

    const result = await refreshTokens();

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/refresh', {
      refreshToken: 'current-refresh',
    });
    expect(result).toEqual(authRes);
  });

  it('sends empty string when no refresh token exists', async () => {
    mockGetRefreshToken.mockReturnValue(null);
    const authRes = createAuthResponse();
    mockApi.post.mockResolvedValue(authRes);

    await refreshTokens();

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/refresh', {
      refreshToken: '',
    });
  });

  it('updates stored tokens after refresh', async () => {
    mockGetRefreshToken.mockReturnValue('old');
    const authRes = createAuthResponse({
      token: 'refreshed-jwt',
      refreshToken: 'refreshed-rt',
    });
    mockApi.post.mockResolvedValue(authRes);

    await refreshTokens();

    expect(mockSetToken).toHaveBeenCalledWith('refreshed-jwt');
    expect(mockSetRefreshToken).toHaveBeenCalledWith('refreshed-rt');
  });
});

// ── getMe ──

describe('getMe', () => {
  it('calls GET /api/auth/me and returns user', async () => {
    const user = createUser({ email: 'me@test.com' });
    mockApi.get.mockResolvedValue(user);

    const result = await getMe();

    expect(mockApi.get).toHaveBeenCalledWith('/api/auth/me');
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

// ── verifyEmail ──

describe('verifyEmail', () => {
  it('calls POST /api/auth/verify-email with token', async () => {
    mockApi.post.mockResolvedValue(undefined);

    await verifyEmail('verify-token-123');

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/verify-email', {
      token: 'verify-token-123',
    });
  });
});

// ── resendVerification ──

describe('resendVerification', () => {
  it('calls POST /api/auth/resend-verification with no body', async () => {
    mockApi.post.mockResolvedValue(undefined);

    await resendVerification();

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/resend-verification');
  });
});

// ── forgotPassword ──

describe('forgotPassword', () => {
  it('calls POST /api/auth/forgot-password with email', async () => {
    mockApi.post.mockResolvedValue(undefined);

    await forgotPassword('forgot@test.com');

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/forgot-password', {
      email: 'forgot@test.com',
    });
  });
});

// ── resetPassword ──

describe('resetPassword', () => {
  it('calls POST /api/auth/reset-password with token and newPassword', async () => {
    mockApi.post.mockResolvedValue(undefined);

    await resetPassword('reset-token', 'newPass123');

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/reset-password', {
      token: 'reset-token',
      newPassword: 'newPass123',
    });
  });
});

// ── deleteAccount ──

describe('deleteAccount', () => {
  it('calls POST /api/account/delete with confirmation', async () => {
    mockApi.post.mockResolvedValue(undefined);

    await deleteAccount('DELETE MY ACCOUNT');

    expect(mockApi.post).toHaveBeenCalledWith('/api/account/delete', {
      confirmation: 'DELETE MY ACCOUNT',
    });
  });
});

// ── cancelDeletion ──

describe('cancelDeletion', () => {
  it('calls POST /api/account/cancel-deletion with no body', async () => {
    mockApi.post.mockResolvedValue(undefined);

    await cancelDeletion();

    expect(mockApi.post).toHaveBeenCalledWith('/api/account/cancel-deletion');
  });
});
