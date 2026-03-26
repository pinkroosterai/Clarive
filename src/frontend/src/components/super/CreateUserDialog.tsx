import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  workspaceId: z.string().min(1, 'Select a workspace'),
  role: z.enum(['Admin', 'Editor', 'Viewer']),
});

export function CreateUserDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [role, setRole] = useState('Editor');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: workspaces } = useQuery({
    queryKey: ['super', 'workspaces'],
    queryFn: getSuperWorkspaces,
    enabled: open,
  });

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

      resetAndClose();
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to create user' }),
  });

  function resetAndClose() {
    setOpen(false);
    setName('');
    setEmail('');
    setWorkspaceId('');
    setRole('Editor');
    setErrors({});
  }

  function handleSubmit() {
    const result = createUserSchema.safeParse({ name, email, workspaceId, role });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    mutation.mutate({ name, email, workspaceId, role });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetAndClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="size-4" />
          Create User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Create a new user account and assign them to a workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
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
          <div className="space-y-2">
            <Label>Workspace</Label>
            <Select
              value={workspaceId}
              onValueChange={(v) => {
                setWorkspaceId(v);
                if (errors.workspaceId) setErrors((prev) => ({ ...prev, workspaceId: '' }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces?.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.workspaceId && (
              <p className="text-xs text-destructive">{errors.workspaceId}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Editor">Editor</SelectItem>
                <SelectItem value="Viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={mutation.isPending} onClick={handleSubmit}>
            {mutation.isPending ? 'Creating...' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
