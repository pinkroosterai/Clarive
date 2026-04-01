import { create } from 'zustand';

import { queryClient } from '@/lib/queryClient';
import {
  setToken,
  getToken,
  setRefreshToken,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
} from '@/services/api/apiClient';
import { getMe } from '@/services/api/profileService';
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
  aiConfigured: boolean;
  webSearchAvailable: boolean;
  setUser: (user: User) => void;
  setMaintenanceMode: (enabled: boolean) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  logout: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((rawSet, get) => {
  // Wrap set to always derive isAuthenticated from token presence.
  // This eliminates sync risk — isAuthenticated is never manually set.
  const set: typeof rawSet = (partial, replace) =>
    rawSet((state) => {
      const updates = typeof partial === 'function' ? partial(state) : partial;
      return { ...updates, isAuthenticated: !!getToken() } as AuthState;
    }, replace);

  return {
    currentUser: null,
    workspaces: [],
    activeWorkspace: null,
    isAuthenticated: !!getToken(),
    isInitialized: false,
    maintenanceMode: false,
    aiConfigured: true,
    webSearchAvailable: false,
    setMaintenanceMode: (enabled: boolean) => set({ maintenanceMode: enabled }),
    setUser: (user: User) => {
      set({ currentUser: user, isInitialized: true });
      // Fetch system status (AI config, maintenance) after login
      getSystemStatus()
        .then((status) => {
          if (status.maintenance) set({ maintenanceMode: true });
          set({ aiConfigured: status.aiConfigured ?? true });
          set({ webSearchAvailable: status.webSearchAvailable ?? false });
        })
        .catch((err) => {
          console.warn('[silentCatch] auth:getSystemStatus:', err);
        });
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
      });
    },
    logout: () => {
      setToken(null);
      setRefreshToken(null);
      setActiveWorkspaceId(null);
      queryClient.clear();
      // Clear per-user hint dismissals to prevent localStorage bloat
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith('cl_hint_')) localStorage.removeItem(key);
      }
      set({
        currentUser: null,
        workspaces: [],
        activeWorkspace: null,
        isInitialized: true,
        maintenanceMode: false,
        aiConfigured: true,
        webSearchAvailable: false,
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
        set({ currentUser: user, isInitialized: true });
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
          set({ aiConfigured: status.aiConfigured ?? true });
          set({ webSearchAvailable: status.webSearchAvailable ?? false });
        } catch {
          // Ignore — maintenance status is non-critical
        }
      } catch {
        setToken(null);
        setRefreshToken(null);
        set({
          currentUser: null,
          isInitialized: true,
          workspaces: [],
          activeWorkspace: null,
        });
      }
    },
  };
});
