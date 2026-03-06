import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';

import { AnvilIcon } from '@/components/icons/AnvilIcon';
import { handleApiError } from '@/lib/handleApiError';
import { getActiveWorkspaceId } from '@/services/api/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { Workspace } from '@/types';

const WorkspaceSelectorPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaces = useAuthStore((s) => s.workspaces);
  const switchWorkspace = useAuthStore((s) => s.switchWorkspace);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [switching, setSwitching] = useState<string | null>(null);
  const [rememberWorkspace, setRememberWorkspace] = useState(
    () => localStorage.getItem('cl_remember_workspace') === 'true'
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (workspaces.length <= 1) {
    return <Navigate to="/" replace />;
  }

  const handleSelect = async (ws: Workspace) => {
    setSwitching(ws.id);
    try {
      await switchWorkspace(ws.id);
      queryClient.clear();
      if (rememberWorkspace) {
        localStorage.setItem('cl_remember_workspace', 'true');
      } else {
        localStorage.removeItem('cl_remember_workspace');
      }
      navigate('/', { replace: true });
    } catch (err: unknown) {
      handleApiError(err, { fallback: 'Failed to switch workspace' });
      setSwitching(null);
    }
  };

  const rememberedId = getActiveWorkspaceId();

  return (
    <div className="flex min-h-screen items-center justify-center auth-bg bg-background px-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="bg-surface/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl elevation-3 p-8">
          <div className="text-center space-y-2 mb-6">
            <AnvilIcon className="mx-auto mb-3 size-16" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Choose a workspace
            </h1>
            <p className="text-foreground-muted text-sm">
              Select which workspace you'd like to open
            </p>
          </div>

          <div className="space-y-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSelect(ws)}
                disabled={switching !== null}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-elevated hover:bg-sidebar-accent hover:border-primary/30 transition-colors text-left disabled:opacity-50"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-semibold shrink-0">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{ws.name}</span>
                    {ws.isPersonal && (
                      <span className="text-[10px] text-foreground-muted bg-surface px-1.5 py-0.5 rounded shrink-0">
                        Personal
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-foreground-muted mt-0.5">
                    <span className="capitalize">{ws.role}</span>
                    <span>·</span>
                    <Users className="size-3" />
                    <span>{ws.memberCount}</span>
                  </div>
                </div>
                {switching === ws.id ? (
                  <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                ) : ws.id === rememberedId ? (
                  <Check className="size-4 text-primary shrink-0" />
                ) : null}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 mt-4 text-sm text-foreground-muted cursor-pointer">
            <input
              type="checkbox"
              checked={rememberWorkspace}
              onChange={(e) => setRememberWorkspace(e.target.checked)}
              className="rounded border-border"
            />
            Always use my last workspace
          </label>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSelectorPage;
