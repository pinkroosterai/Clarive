import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

// Mock the auth store
const mockInitializeAuth = vi.fn();

vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockAuthState),
}));

// Mock AppShell since ProtectedRoute renders it when authenticated
vi.mock("@/components/layout/AppShell", () => ({
  AppShell: () => <div data-testid="app-shell">App Shell Content</div>,
}));

let mockAuthState: Record<string, unknown>;

beforeEach(() => {
  mockAuthState = {
    isAuthenticated: false,
    isInitialized: false,
    initializeAuth: mockInitializeAuth,
  };
  mockInitializeAuth.mockReset();
});

describe("ProtectedRoute", () => {
  it("shows loading spinner when not initialized", () => {
    mockAuthState = {
      isAuthenticated: false,
      isInitialized: false,
      initializeAuth: mockInitializeAuth,
    };

    const { container } = render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute />} />
        </Routes>
      </MemoryRouter>
    );

    // The Loader2 icon renders an SVG with animate-spin class
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("redirects to /login when not authenticated", () => {
    mockAuthState = {
      isAuthenticated: false,
      isInitialized: true,
      initializeAuth: mockInitializeAuth,
    };

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders AppShell when authenticated", () => {
    mockAuthState = {
      isAuthenticated: true,
      isInitialized: true,
      initializeAuth: mockInitializeAuth,
    };

    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  });
});
