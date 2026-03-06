import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService, invitationService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { handleApiError } from "@/lib/handleApiError";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/types";

import { InviteUserDialog } from "./InviteUserDialog";
import { TransferOwnershipDialog } from "./TransferOwnershipDialog";
import { MembersTable } from "./MembersTable";

export default function UserManagement() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === "admin";

  const { data: members, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: userService.getUsersList,
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => invitationService.resendInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Invitation resent");
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => invitationService.revokeInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Invitation revoked");
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: User["role"] }) =>
      userService.updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role updated");
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => userService.removeUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User removed");
    },
    onError: (err: unknown) => handleApiError(err),
  });

  const activeMembers = members?.filter((m) => m.status === "active") ?? [];
  const pendingMembers = members?.filter((m) => m.status === "pending") ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">
          {activeMembers.length} member{activeMembers.length !== 1 ? "s" : ""}
          {pendingMembers.length > 0 && (
            <span className="ml-1 text-warning-text">
              ({pendingMembers.length} pending)
            </span>
          )}
        </p>

        <div className="flex gap-2">
          {isAdmin && (
            <>
              <TransferOwnershipDialog activeMembers={activeMembers} />
              <InviteUserDialog />
            </>
          )}
        </div>
      </div>

      {/* Members table */}
      <MembersTable
        members={members ?? []}
        isAdmin={isAdmin}
        currentUserId={currentUser?.id}
        onRoleChange={(id, role) => roleChangeMutation.mutate({ id, role })}
        onResend={(id) => resendMutation.mutate(id)}
        onRevoke={(id) => revokeMutation.mutate(id)}
        onRemove={(id) => removeMutation.mutate(id)}
        isResending={resendMutation.isPending}
      />
    </div>
  );
}
