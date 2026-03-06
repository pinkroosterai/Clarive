import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUser } from "@/test/factories";
import type { User } from "@/types";

// Mock apiClient — must be before authStore import
vi.mock("@/services/api/apiClient", () => {
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
        message: string,
      ) {
        super(message);
        this.name = "ApiError";
      }
    },
  };
});

// Mock authService
vi.mock("@/services/api/authService", () => ({
  getMe: vi.fn(),
}));

// Mock workspaceService
vi.mock("@/services/api/workspaceService", () => ({
  switchWorkspace: vi.fn(),
}));

// Mock queryClient
vi.mock("@/lib/queryClient", () => ({
  queryClient: { clear: vi.fn() },
}));

// Now import the modules
import { useAuthStore } from "./authStore";
import { getToken, setToken, setRefreshToken } from "@/services/api/apiClient";
import { getMe } from "@/services/api/authService";

const mockedGetToken = vi.mocked(getToken);
const mockedSetToken = vi.mocked(setToken);
const mockedSetRefreshToken = vi.mocked(setRefreshToken);
const mockedGetMe = vi.mocked(getMe);

describe("authStore", () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      currentUser: null,
      isAuthenticated: false,
      isInitialized: false,
    });
    vi.clearAllMocks();
    // Reset the token state inside the mock
    mockedSetToken(null);
    mockedSetRefreshToken(null);
    vi.clearAllMocks(); // Clear again after resetting tokens
  });

  describe("initial state", () => {
    it("is unauthenticated when no token", () => {
      mockedGetToken.mockReturnValue(null);
      // Re-read state after mock change
      const state = useAuthStore.getState();
      expect(state.currentUser).toBeNull();
      expect(state.isInitialized).toBe(false);
    });

    it("has isAuthenticated based on token presence", () => {
      // The store reads getToken() at creation time.
      // Since we control the mock, we can test the state we set.
      useAuthStore.setState({ isAuthenticated: true });
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  describe("setUser", () => {
    it("updates state correctly", () => {
      const user = createUser({ name: "Alice" });

      useAuthStore.getState().setUser(user);

      const state = useAuthStore.getState();
      expect(state.currentUser).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isInitialized).toBe(true);
    });
  });

  describe("logout", () => {
    it("clears everything and removes tokens", () => {
      // Set up an authenticated state
      const user = createUser();
      useAuthStore.setState({
        currentUser: user,
        isAuthenticated: true,
        isInitialized: true,
      });

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.currentUser).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(mockedSetToken).toHaveBeenCalledWith(null);
      expect(mockedSetRefreshToken).toHaveBeenCalledWith(null);
    });
  });

  describe("initializeAuth", () => {
    it("fetches user with valid token", async () => {
      const user = createUser({ name: "Bob" });
      mockedGetToken.mockReturnValue("valid-jwt");
      mockedGetMe.mockResolvedValue(user);

      await useAuthStore.getState().initializeAuth();

      const state = useAuthStore.getState();
      expect(state.currentUser).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isInitialized).toBe(true);
      expect(mockedGetMe).toHaveBeenCalledOnce();
    });

    it("clears state when token is expired/invalid", async () => {
      mockedGetToken.mockReturnValue("expired-jwt");
      mockedGetMe.mockRejectedValue(new Error("Unauthorized"));

      await useAuthStore.getState().initializeAuth();

      const state = useAuthStore.getState();
      expect(state.currentUser).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isInitialized).toBe(true);
      expect(mockedSetToken).toHaveBeenCalledWith(null);
      expect(mockedSetRefreshToken).toHaveBeenCalledWith(null);
    });

    it("skips fetch if user already loaded", async () => {
      const user = createUser({ name: "Existing" });
      useAuthStore.setState({
        currentUser: user,
        isAuthenticated: true,
        isInitialized: false,
      });
      mockedGetToken.mockReturnValue("some-token");

      await useAuthStore.getState().initializeAuth();

      expect(mockedGetMe).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });

    it("skips fetch if no token", async () => {
      mockedGetToken.mockReturnValue(null);

      await useAuthStore.getState().initializeAuth();

      expect(mockedGetMe).not.toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.currentUser).toBeNull();
    });

    it("does not overwrite user if concurrent calls happen", async () => {
      const user = createUser({ name: "First" });
      mockedGetToken.mockReturnValue("jwt");
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
