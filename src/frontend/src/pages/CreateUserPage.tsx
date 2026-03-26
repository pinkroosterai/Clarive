import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { handleApiError } from '@/lib/handleApiError';
import {
  createSuperUser,
  getSuperWorkspaces,
  type CreateUserRequest,
} from '@/services/api/superService';

interface WorkspaceRow {
  id: string;
  workspaceId: string;
  role: string;
}

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
});

const CreateUserPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [workspaceRows, setWorkspaceRows] = useState<WorkspaceRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: availableWorkspaces } = useQuery({
    queryKey: ['super', 'workspaces'],
    queryFn: getSuperWorkspaces,
  });

  const selectedWorkspaceIds = new Set(
    workspaceRows.map((r) => r.workspaceId).filter(Boolean),
  );

  const mutation = useMutation({
    mutationFn: (req: CreateUserRequest) => createSuperUser(req),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ['super', 'users'] });

      if (res.generatedPassword) {
        try {
          await navigator.clipboard.writeText(res.generatedPassword);
          toast.success(
            `User created. Password copied to clipboard: ${res.generatedPassword}`,
            { duration: 15000 },
          );
        } catch {
          toast.success(`User created. Password: ${res.generatedPassword}`, {
            duration: 15000,
          });
        }
      } else {
        toast.success('User created. A password setup email has been sent.');
      }

      navigate('/super');
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to create user' }),
  });

  function addWorkspaceRow() {
    setWorkspaceRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), workspaceId: '', role: 'Editor' },
    ]);
  }

  function removeWorkspaceRow(id: string) {
    setWorkspaceRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateWorkspaceRow(id: string, field: 'workspaceId' | 'role', value: string) {
    setWorkspaceRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  function handleSubmit() {
    const result = createUserSchema.safeParse({ name, email });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    // Validate workspace rows that have been started
    const incompleteRow = workspaceRows.find((r) => !r.workspaceId);
    if (incompleteRow) {
      setErrors({ workspaces: 'Please select a workspace for all rows or remove empty ones.' });
      return;
    }

    setErrors({});

    const workspaces = workspaceRows
      .filter((r) => r.workspaceId)
      .map((r) => ({ workspaceId: r.workspaceId, role: r.role }));

    mutation.mutate({ name, email, workspaces });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <button
          onClick={() => navigate('/super')}
          className="flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-6 transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to Users
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
            <UserPlus className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Create User</h1>
            <p className="text-sm text-foreground-muted">
              Create a new user account and assign them to workspaces.
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-surface elevation-1 p-6 space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="create-name">Name</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="John Doe"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholder="user@example.com"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          {/* Workspace Assignments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Workspace Assignments</Label>
                <p className="text-xs text-foreground-muted mt-0.5">
                  Optional. The user always gets a personal workspace.
                </p>
              </div>
            </div>

            {workspaceRows.map((row) => {
              const filteredWorkspaces = availableWorkspaces?.filter(
                (ws) => ws.id === row.workspaceId || !selectedWorkspaceIds.has(ws.id),
              );

              return (
                <div key={row.id} className="flex items-center gap-2">
                  <Select
                    value={row.workspaceId}
                    onValueChange={(v) => updateWorkspaceRow(row.id, 'workspaceId', v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredWorkspaces?.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={row.role}
                    onValueChange={(v) => updateWorkspaceRow(row.id, 'role', v)}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Editor">Editor</SelectItem>
                      <SelectItem value="Viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeWorkspaceRow(row.id)}
                    className="shrink-0 text-foreground-muted hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}

            {errors.workspaces && (
              <p className="text-xs text-destructive">{errors.workspaces}</p>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={addWorkspaceRow}
              disabled={
                availableWorkspaces !== undefined &&
                workspaceRows.length >= availableWorkspaces.length
              }
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Add Workspace
            </Button>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <Button
              disabled={mutation.isPending}
              onClick={handleSubmit}
              className="gap-1.5"
            >
              <UserPlus className="size-4" />
              {mutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateUserPage;
