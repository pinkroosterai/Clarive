import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/api/apiClient", () => ({
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
  setActiveWorkspaceId: vi.fn(),
}));

import { api, setToken, setRefreshToken, setActiveWorkspaceId } from "@/services/api/apiClient";
import { switchWorkspace, getWorkspaces, leaveWorkspace } from "./workspaceService";
import { createUser, createWorkspace } from "@/test/factories";

const mockApi = vi.mocked(api);
const mockSetToken = vi.mocked(setToken);
const mockSetRefreshToken = vi.mocked(setRefreshToken);
const mockSetActiveWorkspaceId = vi.mocked(setActiveWorkspaceId);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── switchWorkspace ──

describe("switchWorkspace", () => {
  it("calls POST /api/auth/switch-workspace with tenantId", async () => {
    const user = createUser();
    const response = { token: "new-jwt", refreshToken: "new-rt", user };
    mockApi.post.mockResolvedValue(response);

    const result = await switchWorkspace("tenant-123");

    expect(mockApi.post).toHaveBeenCalledWith("/api/auth/switch-workspace", {
      tenantId: "tenant-123",
    });
    expect(result).toEqual(response);
  });

  it("sets new token and refresh token after switch", async () => {
    const response = { token: "switched-jwt", refreshToken: "switched-rt", user: createUser() };
    mockApi.post.mockResolvedValue(response);

    await switchWorkspace("tenant-456");

    expect(mockSetToken).toHaveBeenCalledWith("switched-jwt");
    expect(mockSetRefreshToken).toHaveBeenCalledWith("switched-rt");
  });

  it("sets active workspace ID after switch", async () => {
    const response = { token: "jwt", refreshToken: "rt", user: createUser() };
    mockApi.post.mockResolvedValue(response);

    await switchWorkspace("tenant-789");

    expect(mockSetActiveWorkspaceId).toHaveBeenCalledWith("tenant-789");
  });
});

// ── getWorkspaces ──

describe("getWorkspaces", () => {
  it("calls GET /api/workspaces and returns workspace list", async () => {
    const workspaces = [
      createWorkspace({ name: "Personal", isPersonal: true }),
      createWorkspace({ name: "Team", isPersonal: false, role: "editor" }),
    ];
    mockApi.get.mockResolvedValue({ workspaces });

    const result = await getWorkspaces();

    expect(mockApi.get).toHaveBeenCalledWith("/api/workspaces");
    expect(result.workspaces).toHaveLength(2);
    expect(result.workspaces[0].name).toBe("Personal");
  });
});

// ── leaveWorkspace ──

describe("leaveWorkspace", () => {
  it("calls POST /api/workspaces/{id}/leave", async () => {
    mockApi.post.mockResolvedValue(undefined);

    await leaveWorkspace("tenant-abc");

    expect(mockApi.post).toHaveBeenCalledWith(
      "/api/workspaces/tenant-abc/leave",
    );
  });
});
