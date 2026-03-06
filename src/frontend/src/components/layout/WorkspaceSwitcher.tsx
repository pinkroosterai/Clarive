import { useState } from "react";
import { ChevronsUpDown, Check, Settings, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { handleApiError } from "@/lib/handleApiError";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaces = useAuthStore((s) => s.workspaces);
  const activeWorkspace = useAuthStore((s) => s.activeWorkspace);
  const switchWorkspace = useAuthStore((s) => s.switchWorkspace);

  const [switching, setSwitching] = useState<string | null>(null);

  const handleSwitch = async (workspaceId: string) => {
    if (workspaceId === activeWorkspace?.id || switching) return;
    setSwitching(workspaceId);
    try {
      await switchWorkspace(workspaceId);
      queryClient.clear();
      navigate("/", { replace: true });
    } catch (err: unknown) {
      handleApiError(err, { fallback: "Failed to switch workspace" });
    } finally {
      setSwitching(null);
    }
  };

  const initial = activeWorkspace?.name?.charAt(0).toUpperCase() ?? "W";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={activeWorkspace?.name ?? "Workspace"}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {activeWorkspace?.avatarUrl ? (
                <img
                  src={activeWorkspace.avatarUrl}
                  alt=""
                  className="size-8 rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                  {initial}
                </div>
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeWorkspace?.name ?? "Workspace"}
                </span>
                <span className="truncate text-xs text-foreground-muted capitalize">
                  {activeWorkspace?.role ?? "member"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-foreground-muted">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                className="gap-2 p-2"
                disabled={switching !== null}
              >
                {ws.avatarUrl ? (
                  <img
                    src={ws.avatarUrl}
                    alt=""
                    className="size-6 rounded-sm object-cover"
                  />
                ) : (
                  <div className="flex size-6 items-center justify-center rounded-sm border bg-elevated text-xs font-medium">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 truncate">{ws.name}</span>
                {ws.isPersonal && (
                  <span className="text-[10px] text-foreground-muted bg-elevated px-1.5 py-0.5 rounded">
                    Personal
                  </span>
                )}
                {switching === ws.id ? (
                  <Loader2 className="ml-auto size-4 animate-spin text-primary" />
                ) : ws.id === activeWorkspace?.id ? (
                  <Check className="ml-auto size-4 text-primary" />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings?tab=users")} className="gap-2 p-2">
              <Settings className="size-4" />
              <span>Manage workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
