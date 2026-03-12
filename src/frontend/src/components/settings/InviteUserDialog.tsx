import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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
import { inviteUserSchema } from '@/lib/validationSchemas';
import { invitationService } from '@/services';

export function InviteUserDialog() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [emailError, setEmailError] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: () => invitationService.createInvitation(inviteEmail, inviteRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Invitation sent');
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('editor');
    },
    onError: (err: unknown) => handleApiError(err),
  });

  return (
    <Dialog
      open={inviteOpen}
      onOpenChange={(o) => {
        setInviteOpen(o);
        if (!o) {
          setInviteEmail('');
          setInviteRole('editor');
          setEmailError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="size-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>Send an email invitation to join your workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              placeholder="user@example.com"
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={inviteRole}
              onValueChange={(v) => setInviteRole(v as 'editor' | 'viewer')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!inviteEmail || inviteMutation.isPending}
            onClick={() => {
              const result = inviteUserSchema.safeParse({ email: inviteEmail, role: inviteRole });
              if (!result.success) {
                setEmailError(result.error.issues[0]?.message ?? 'Invalid input');
                return;
              }
              inviteMutation.mutate();
            }}
          >
            {inviteMutation.isPending ? 'Sending\u2026' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
