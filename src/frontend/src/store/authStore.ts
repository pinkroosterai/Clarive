import { create } from 'zustand';

import { queryClient } from '@/lib/queryClient';
import {
  setToken,
  getToken,
  setRefreshToken,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
} from '@/services/api/apiClient';
import { getMe } from '@/services/api/authService';
import { getSystemStatus } from '@/services/api/superService';
import { switchWorkspace as apiSwitchWorkspace } from '@/services/api/workspaceService';
import type { User, Workspace } from '@/types';

interface AuthState {
  currentUser: User | null;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  maintenanceMode: boolean;
  setUser: (user: User) => void;
  setMaintenanceMode: (enabled: boolean) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  logout: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  workspaces: [],
  activeWorkspace: null,
  isAuthenticated: !!getToken(),
  isInitialized: false,
  maintenanceMode: false,
  setMaintenanceMode: (enabled: boolean) => set({ maintenanceMode: enabled }),
  setUser: (user: User) => {
    set({ currentUser: user, isAuthenticated: true, isInitialized: true });
  },
  setWorkspaces: (workspaces: Workspace[]) => {
    const activeId = getActiveWorkspaceId();
    const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;
    if (active) setActiveWorkspaceId(active.id);
    set({ workspaces, activeWorkspace: active });
  },
  switchWorkspace: async (workspaceId: string) => {
    const { user } = await apiSwitchWorkspace(workspaceId);
    const workspaces = get().workspaces.map((w) =>
      w.id === workspaceId ? { ...w, role: user.role } : w
    );
    const active = workspaces.find((w) => w.id === workspaceId) ?? null;
    set({
      currentUser: user,
      workspaces,
      activeWorkspace: active,
      isAuthenticated: true,
    });
  },
  logout: () => {
    setToken(null);
    setRefreshToken(null);
    setActiveWorkspaceId(null);
    queryClient.clear();
    set({
      currentUser: null,
      workspaces: [],
      activeWorkspace: null,
      isAuthenticated: false,
      isInitialized: true,
      maintenanceMode: false,
    });
  },
  initializeAuth: async () => {
    if (get().currentUser || !getToken()) {
      set({ isInitialized: true });
      return;
    }
    try {
      const data = await getMe();
      const { workspaces: ws, ...user } = data;
      set({ currentUser: user, isAuthenticated: true, isInitialized: true });
      if (ws) {
        const activeId = getActiveWorkspaceId();
        const active = ws.find((w) => w.id === activeId) ?? ws[0] ?? null;
        if (active) setActiveWorkspaceId(active.id);
        set({ workspaces: ws, activeWorkspace: active });
      }
      // Check maintenance status so super users see the banner
      // and non-super users get blocked before any flash
      try {
        const status = await getSystemStatus();
        if (status.maintenance) set({ maintenanceMode: true });
      } catch {
        // Ignore — maintenance status is non-critical
      }
    } catch {
      setToken(null);
      setRefreshToken(null);
      set({
        currentUser: null,
        isAuthenticated: false,
        isInitialized: true,
        workspaces: [],
        activeWorkspace: null,
      });
    }
  },
}));
