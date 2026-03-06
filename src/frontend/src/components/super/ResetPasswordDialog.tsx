import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { handleApiError } from '@/lib/handleApiError';
import { resetUserPassword, type SuperUser } from '@/services/api/superService';

interface ResetPasswordDialogProps {
  user: SuperUser | null;
  onClose: () => void;
}

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const resetMutation = useMutation({
    mutationFn: (userId: string) => resetUserPassword(userId),
    onSuccess: async (res) => {
      try {
        await navigator.clipboard.writeText(res.newPassword);
        toast.success('New password copied to clipboard');
      } catch {
        toast.success(`New password: ${res.newPassword}`, { duration: 15000 });
      }
      onClose();
    },
    onError: (err) => {
      handleApiError(err, { fallback: 'Failed to reset password' });
    },
  });

  return (
    <AlertDialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset password for {user?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will generate a new random password for{' '}
            <span className="font-medium">{user?.email}</span>. The new password will be copied to
            your clipboard.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            disabled={resetMutation.isPending}
            onClick={() => user && resetMutation.mutate(user.id)}
          >
            <KeyRound className="size-4 mr-1.5" />
            {resetMutation.isPending ? 'Resetting...' : 'Reset Password'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
