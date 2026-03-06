import { renderHook, act } from "@testing-library/react";
import { createElement } from "react";

// Track matchMedia listeners
let matchMediaListeners: Array<() => void> = [];
let matchMediaMatches = false;

// Must mock matchMedia before any imports that use it
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: matchMediaMatches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_event: string, handler: () => void) => {
      matchMediaListeners.push(handler);
    },
    removeEventListener: (_event: string, handler: () => void) => {
      matchMediaListeners = matchMediaListeners.filter((h) => h !== handler);
    },
    dispatchEvent: () => false,
  }),
});

// Mock profileService (fire-and-forget API calls)
const mockUpdateProfile = vi.fn().mockResolvedValue({});
vi.mock("@/services/api/profileService", () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// Mock authStore
let mockAuthState = {
  isAuthenticated: false,
  currentUser: null as { themePreference?: string | null } | null,
};
vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) =>
    selector(mockAuthState),
}));

import { useThemeProvider, ThemeContext, type ThemeContextValue } from "./useTheme";

function wrapper({ children }: { children: React.ReactNode }) {
  const value = useThemeProvider();
  return createElement(ThemeContext.Provider, { value }, children);
}

describe("useThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    matchMediaListeners = [];
    matchMediaMatches = false;
    mockUpdateProfile.mockClear();
    mockAuthState = { isAuthenticated: false, currentUser: null };
    document.documentElement.classList.remove("dark", "theme-transitioning");
  });

  describe("initial resolution", () => {
    it("defaults to dark when no localStorage and OS prefers dark", () => {
      matchMediaMatches = false; // prefers-color-scheme: light = false → dark
      const { result } = renderHook(() => useThemeProvider());
      expect(result.current.theme).toBe("dark");
      expect(result.current.themePreference).toBe("system");
    });

    it("defaults to light when OS prefers light", () => {
      matchMediaMatches = true; // prefers-color-scheme: light = true
      const { result } = renderHook(() => useThemeProvider());
      expect(result.current.theme).toBe("light");
      expect(result.current.themePreference).toBe("system");
    });

    it("reads preference from localStorage", () => {
      localStorage.setItem("cl_theme", "light");
      const { result } = renderHook(() => useThemeProvider());
      expect(result.current.theme).toBe("light");
      expect(result.current.themePreference).toBe("light");
    });

    it("reads dark preference from localStorage", () => {
      localStorage.setItem("cl_theme", "dark");
      const { result } = renderHook(() => useThemeProvider());
      expect(result.current.theme).toBe("dark");
      expect(result.current.themePreference).toBe("dark");
    });
  });

  describe("setThemePreference", () => {
    it("switches to light mode", () => {
      const { result } = renderHook(() => useThemeProvider());

      act(() => {
        result.current.setThemePreference("light");
      });

      expect(result.current.theme).toBe("light");
      expect(result.current.themePreference).toBe("light");
      expect(localStorage.getItem("cl_theme")).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("switches to dark mode", () => {
      localStorage.setItem("cl_theme", "light");
      const { result } = renderHook(() => useThemeProvider());

      act(() => {
        result.current.setThemePreference("dark");
      });

      expect(result.current.theme).toBe("dark");
      expect(localStorage.getItem("cl_theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("persists to localStorage", () => {
      const { result } = renderHook(() => useThemeProvider());

      act(() => {
        result.current.setThemePreference("light");
      });

      expect(localStorage.getItem("cl_theme")).toBe("light");
    });

    it("calls updateProfile when authenticated", () => {
      mockAuthState = { isAuthenticated: true, currentUser: null };
      const { result } = renderHook(() => useThemeProvider());

      act(() => {
        result.current.setThemePreference("dark");
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith({
        themePreference: "dark",
      });
    });

    it("does not call updateProfile when not authenticated", () => {
      mockAuthState = { isAuthenticated: false, currentUser: null };
      const { result } = renderHook(() => useThemeProvider());

      act(() => {
        result.current.setThemePreference("light");
      });

      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });
  });

  describe("system preference", () => {
    it("resolves system to light when OS prefers light", () => {
      matchMediaMatches = true;
      const { result } = renderHook(() => useThemeProvider());

      act(() => {
        result.current.setThemePreference("system");
      });

      expect(result.current.theme).toBe("light");
    });

    it("resolves system to dark when OS prefers dark", () => {
      matchMediaMatches = false;
      const { result } = renderHook(() => useThemeProvider());

      act(() => {
        result.current.setThemePreference("system");
      });

      expect(result.current.theme).toBe("dark");
    });
  });

  describe("backend sync", () => {
    it("syncs backend preference to localStorage on user change", () => {
      mockAuthState = {
        isAuthenticated: true,
        currentUser: { themePreference: "light" },
      };
      renderHook(() => useThemeProvider());

      expect(localStorage.getItem("cl_theme")).toBe("light");
    });
  });
});
