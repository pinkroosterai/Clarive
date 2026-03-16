import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createUser } from '@/test/factories';

// Mock apiClient — must be before authStore import
vi.mock('@/services/api/apiClient', () => {
  let token: string | null = null;
  let refreshToken: string | null = null;
  let workspaceId: string | null = null;
  return {
    getToken: vi.fn(() => token),
    setToken: vi.fn((t: string | null) => {
      token = t;
    }),
    getRefreshToken: vi.fn(() => refreshToken),
    setRefreshToken: vi.fn((t: string | null) => {
      refreshToken = t;
    }),
    getActiveWorkspaceId: vi.fn(() => workspaceId),
    setActiveWorkspaceId: vi.fn((id: string | null) => {
      workspaceId = id;
    }),
    api: {
      get: vi.fn(),
      post: vi.fn(),
    },
    ApiError: class extends Error {
      constructor(
        public status: number,
        public code: string,
        message: string
      ) {
        super(message);
        this.name = 'ApiError';
      }
    },
  };
});

// Mock profileService
vi.mock('@/services/api/profileService', () => ({
  getMe: vi.fn(),
}));

// Mock workspaceService
vi.mock('@/services/api/workspaceService', () => ({
  switchWorkspace: vi.fn(),
}));

// Mock queryClient
vi.mock('@/lib/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}));

// Now import the modules
import { useAuthStore } from './authStore';

import { getToken, setToken, setRefreshToken } from '@/services/api/apiClient';
import { getMe } from '@/services/api/profileService';

const mockedGetToken = vi.mocked(getToken);
const mockedSetToken = vi.mocked(setToken);
const mockedSetRefreshToken = vi.mocked(setRefreshToken);
const mockedGetMe = vi.mocked(getMe);

describe('authStore', () => {
  beforeEach(() => {
    // Reset the token state inside the mock closure first
    mockedSetToken(null);
    mockedSetRefreshToken(null);
    // Reset store state — isAuthenticated will be derived as false (no token)
    useAuthStore.setState({
      currentUser: null,
      isInitialized: false,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('is unauthenticated when no token', () => {
      const state = useAuthStore.getState();
      expect(state.currentUser).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(false);
    });

    it('derives isAuthenticated from token presence via actions', () => {
      // isAuthenticated is derived from getToken() inside store actions.
      // Verify via setUser (which goes through the wrapped set).
      const user = createUser();
      mockedSetToken('jwt');
      useAuthStore.getState().setUser(user);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // After logout (which calls setToken(null)), isAuthenticated flips to false
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('setUser', () => {
    it('updates state correctly', () => {
      const user = createUser({ name: 'Alice' });
      // In real usage, token is set by login response before setUser is called
      mockedSetToken('jwt-token');

      useAuthStore.getState().setUser(user);

      const state = useAuthStore.getState();
      expect(state.currentUser).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isInitialized).toBe(true);
    });
  });

  describe('logout', () => {
    it('clears everything and removes tokens', () => {
      // Set up an authenticated state
      const user = createUser();
      mockedSetToken('jwt-token');
      useAuthStore.setState({
        currentUser: user,
        isInitialized: true,
      });
      vi.clearAllMocks();

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.currentUser).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(mockedSetToken).toHaveBeenCalledWith(null);
      expect(mockedSetRefreshToken).toHaveBeenCalledWith(null);
    });
  });

  describe('initializeAuth', () => {
    it('fetches user with valid token', async () => {
      const user = createUser({ name: 'Bob' });
      mockedSetToken('valid-jwt');
      mockedGetMe.mockResolvedValue(user);

      await useAuthStore.getState().initializeAuth();

      const state = useAuthStore.getState();
      expect(state.currentUser).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isInitialized).toBe(true);
      expect(mockedGetMe).toHaveBeenCalledOnce();
    });

    it('clears state when token is expired/invalid', async () => {
      mockedSetToken('expired-jwt');
      mockedGetMe.mockRejectedValue(new Error('Unauthorized'));

      await useAuthStore.getState().initializeAuth();

      const state = useAuthStore.getState();
      expect(state.currentUser).toBeNull();
      // After failure, setToken(null) is called, so isAuthenticated derives as false
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(mockedSetToken).toHaveBeenCalledWith(null);
      expect(mockedSetRefreshToken).toHaveBeenCalledWith(null);
    });

    it('skips fetch if user already loaded', async () => {
      const user = createUser({ name: 'Existing' });
      mockedSetToken('some-token');
      useAuthStore.setState({
        currentUser: user,
        isInitialized: false,
      });

      await useAuthStore.getState().initializeAuth();

      expect(mockedGetMe).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });

    it('skips fetch if no token', async () => {
      await useAuthStore.getState().initializeAuth();

      expect(mockedGetMe).not.toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.currentUser).toBeNull();
    });

    it('does not overwrite user if concurrent calls happen', async () => {
      const user = createUser({ name: 'First' });
      mockedSetToken('jwt');
      mockedGetMe.mockResolvedValue(user);

      // Call twice concurrently
      const p1 = useAuthStore.getState().initializeAuth();
      const p2 = useAuthStore.getState().initializeAuth();
      await Promise.all([p1, p2]);

      expect(useAuthStore.getState().currentUser).toEqual(user);
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });
  });
});
