import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, RotateCw, Clock } from "lucide-react";
import type { TeamMember, User } from "@/types";

const roleBadgeClass: Record<string, string> = {
  admin: "bg-role-admin-bg text-role-admin-text border-role-admin-border",
  editor: "bg-role-editor-bg text-role-editor-text border-role-editor-border",
  viewer: "bg-role-viewer-bg text-role-viewer-text border-role-viewer-border",
};

function formatExpiry(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

interface MembersTableProps {
  members: TeamMember[];
  isAdmin: boolean;
  currentUserId: string | undefined;
  onRoleChange: (id: string, role: User["role"]) => void;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
  onRemove: (id: string) => void;
  isResending: boolean;
}

export function MembersTable({
  members,
  isAdmin,
  currentUserId,
  onRoleChange,
  onResend,
  onRevoke,
  onRemove,
  isResending,
}: MembersTableProps) {
  return (
    <div className="bg-surface rounded-xl elevation-1 border border-border-subtle overflow-clip">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.status === "active" && member.id === currentUserId;
              const isPending = member.status === "pending";
              return (
                <TableRow
                  key={member.id}
                  className={isSelf ? "bg-primary/5" : isPending ? "opacity-70" : undefined}
                >
                  <TableCell className="font-medium">
                    {member.name ?? <span className="text-foreground-muted italic">Invited</span>}
                    {isSelf && (
                      <span className="ml-2 text-xs text-foreground-muted">
                        (you)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    {isAdmin && !isSelf && !isPending ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) =>
                          onRoleChange(member.id, v as User["role"])
                        }
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={roleBadgeClass[member.role] ?? roleBadgeClass.viewer}>
                        {member.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isPending ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="bg-warning-bg text-warning-text border-warning-border">
                          <Clock className="size-3 mr-1" />
                          Pending
                        </Badge>
                        {member.expiresAt && (
                          <span className="text-xs text-foreground-muted">
                            {formatExpiry(member.expiresAt)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="bg-success-bg text-success-text border-success-border">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {isPending ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-foreground-muted hover:text-foreground"
                            onClick={() => onResend(member.id)}
                            disabled={isResending}
                            title="Resend invitation"
                          >
                            <RotateCw className="size-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                title="Revoke invitation"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Revoke invitation for {member.email}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  The invitation link will no longer work. You can
                                  send a new invitation later.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => onRevoke(member.id)}
                                >
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : !isSelf ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Remove {member.name}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                They will lose access to Clarive. This action
                                cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => onRemove(member.id)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
