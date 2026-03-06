import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { handleApiError } from '@/lib/handleApiError';
import { invitationService } from '@/services';
import { useAuthStore } from '@/store/authStore';
import type { PendingWorkspaceInvitation } from '@/types';

export function InvitationNotificationBell() {
  const [open, setOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const setWorkspaces = useAuthStore((s) => s.setWorkspaces);
  const workspaces = useAuthStore((s) => s.workspaces);

  const { data: count = 0 } = useQuery({
    queryKey: ['invitation-pending-count'],
    queryFn: invitationService.getPendingCount,
    refetchInterval: 60_000,
  });

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitation-pending-list'],
    queryFn: invitationService.getPendingInvitations,
    enabled: open,
  });

  async function handleRespond(invitation: PendingWorkspaceInvitation, accept: boolean) {
    setRespondingId(invitation.id);
    try {
      const result = await invitationService.respondToInvitation(invitation.id, accept);

      if (accept && result.workspace) {
        setWorkspaces([...workspaces, result.workspace]);
        toast.success(`Joined ${invitation.workspaceName}`);
      } else {
        toast.success('Invitation declined');
      }

      await queryClient.invalidateQueries({ queryKey: ['invitation-pending-count'] });
      await queryClient.invalidateQueries({ queryKey: ['invitation-pending-list'] });
    } catch (err) {
      handleApiError(err);
    } finally {
      setRespondingId(null);
    }
  }

  if (count === 0) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton tooltip="Pending Invitations">
              <Bell className="size-4" />
              <span>Invitations</span>
              <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {count}
              </span>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-80 p-0">
            <div className="border-b px-4 py-3">
              <h4 className="text-sm font-semibold">Pending Invitations</h4>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-foreground-muted" />
                </div>
              ) : invitations.length === 0 ? (
                <p className="py-6 text-center text-sm text-foreground-muted">
                  No pending invitations
                </p>
              ) : (
                invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                      {inv.workspaceName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{inv.workspaceName}</p>
                      <p className="text-xs text-foreground-muted">
                        {inv.invitedBy} &middot; {inv.role}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2 text-xs"
                          disabled={respondingId === inv.id}
                          onClick={() => handleRespond(inv, true)}
                        >
                          {respondingId === inv.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Check className="mr-1 size-3" />
                          )}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={respondingId === inv.id}
                          onClick={() => handleRespond(inv, false)}
                        >
                          <X className="mr-1 size-3" />
                          Decline
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
