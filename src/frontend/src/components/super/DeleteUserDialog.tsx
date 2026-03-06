import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { deleteSuperUser, type SuperUser } from '@/services/api/superService';

interface DeleteUserDialogProps {
  user: SuperUser | null;
  onClose: () => void;
}

export function DeleteUserDialog({ user, onClose }: DeleteUserDialogProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: ({ userId, hard }: { userId: string; hard: boolean }) =>
      deleteSuperUser(userId, hard),
    onSuccess: (_data, { hard }) => {
      queryClient.invalidateQueries({ queryKey: ['super', 'users'] });
      toast.success(hard ? 'User permanently deleted' : 'User scheduled for deletion');
      onClose();
    },
    onError: (err) => {
      handleApiError(err, { fallback: 'Failed to delete user' });
    },
  });

  return (
    <AlertDialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {user?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium">{user?.email}</span> — choose how to handle this account:
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            disabled={deleteMutation.isPending}
            onClick={() => user && deleteMutation.mutate({ userId: user.id, hard: false })}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Soft Delete (Schedule)'}
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => user && deleteMutation.mutate({ userId: user.id, hard: true })}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Hard Delete (Permanent)'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
