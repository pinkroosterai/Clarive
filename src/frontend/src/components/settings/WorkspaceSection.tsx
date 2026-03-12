import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, LogOut, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handleApiError';
import { workspaceNameSchema } from '@/lib/validationSchemas';
import { tenantService, workspaceService } from '@/services';
import { useAuthStore } from '@/store/authStore';

export default function WorkspaceSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = useAuthStore((s) => s.currentUser?.role === 'admin');
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const workspaces = useAuthStore((s) => s.workspaces);
  const setWorkspaces = useAuthStore((s) => s.setWorkspaces);
  const switchWorkspace = useAuthStore((s) => s.switchWorkspace);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant'],
    queryFn: tenantService.getTenant,
  });

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Sync initial value once loaded
  if (tenant && !initialized) {
    setName(tenant.name);
    setInitialized(true);
  }

  const updateMutation = useMutation({
    mutationFn: () => tenantService.updateTenantName(name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Workspace name updated');
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const avatarUpload = useMutation({
    mutationFn: (file: File) => tenantService.uploadWorkspaceAvatar(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      // Update the active workspace avatarUrl in authStore
      if (activeWorkspace) {
        const updated = workspaces.map((w) =>
          w.id === activeWorkspace.id ? { ...w, avatarUrl: data.avatarUrl } : w
        );
        setWorkspaces(updated);
      }
      toast.success('Workspace avatar updated');
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to upload avatar' }),
  });

  const avatarDelete = useMutation({
    mutationFn: () => tenantService.deleteWorkspaceAvatar(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      if (activeWorkspace) {
        const updated = workspaces.map((w) =>
          w.id === activeWorkspace.id ? { ...w, avatarUrl: null } : w
        );
        setWorkspaces(updated);
      }
      toast.success('Workspace avatar removed');
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to remove avatar' }),
  });

  const leaveMutation = useMutation({
    mutationFn: () => workspaceService.leaveWorkspace(activeWorkspace!.id),
    onSuccess: async () => {
      const leftName = activeWorkspace!.name;
      const remaining = workspaces.filter((w) => w.id !== activeWorkspace!.id);
      setWorkspaces(remaining);
      const personal = remaining.find((w) => w.isPersonal) ?? remaining[0];
      if (personal) {
        try {
          await switchWorkspace(personal.id);
        } catch {
          // Switch failed but leave succeeded — still navigate away
        }
      }
      queryClient.clear();
      toast.success(`You have left ${leftName}`);
      navigate('/', { replace: true });
    },
    onError: (err: unknown) => handleApiError(err),
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Unsupported format. Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image exceeds the 3 MB size limit.');
      return;
    }

    avatarUpload.mutate(file);
    e.target.value = '';
  }

  if (isLoading) {
    return <Skeleton className="h-10 w-64" />;
  }

  const isDirty = name.trim() !== (tenant?.name ?? '');
  const canLeave = activeWorkspace && !activeWorkspace.isPersonal;
  const avatarBusy = avatarUpload.isPending || avatarDelete.isPending;
  const avatarUrl = tenant?.avatarUrl ?? activeWorkspace?.avatarUrl;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Avatar Section */}
      {isAdmin && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Workspace Avatar</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 rounded-lg">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Workspace avatar" />}
                <AvatarFallback className="rounded-lg text-2xl">
                  {(tenant?.name ?? activeWorkspace?.name ?? 'W').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {avatarBusy && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={avatarBusy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="mr-1.5 h-4 w-4" />
                  Upload
                </Button>
                {avatarUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={avatarBusy}
                    onClick={() => avatarDelete.mutate()}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-foreground-muted">JPEG, PNG, or WebP. Max 3 MB.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </section>
      )}

      {isAdmin && <Separator />}

      {/* Workspace Name */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Workspace</h2>
        <div className="flex items-end gap-3 max-w-md">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="workspace-name">Name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="My workspace"
              disabled={!isAdmin}
              maxLength={255}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          {isAdmin && (
            <Button
              disabled={!isDirty || !name.trim() || updateMutation.isPending}
              onClick={() => {
                const result = workspaceNameSchema.safeParse(name.trim());
                if (!result.success) {
                  setNameError(result.error.issues[0]?.message ?? 'Invalid name');
                  return;
                }
                updateMutation.mutate();
              }}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
        {!isAdmin && (
          <p className="text-xs text-foreground-muted">
            Only admins can change the workspace name.
          </p>
        )}
      </section>

      {canLeave && (
        <>
          <Separator />
          <section>
            <div className="flex items-center justify-between max-w-md">
              <div>
                <p className="text-sm font-medium text-foreground">Leave workspace</p>
                <p className="text-xs text-foreground-muted">
                  You will lose access to all content in this workspace.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={leaveMutation.isPending}>
                    {leaveMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LogOut className="size-4" />
                    )}
                    Leave
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave workspace?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to leave <strong>{activeWorkspace.name}</strong>? You
                      will lose access to all prompts and data in this workspace. An admin will need
                      to re-invite you to regain access.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => leaveMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Leave workspace
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
