import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { handleApiError } from "@/lib/handleApiError";

import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AccountDeletionSection() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const canDelete = confirmation === "DELETE";

  const handleDelete = async () => {
    setLoading(true);
    try {
      await authService.deleteAccount("DELETE");
      toast.success("Account scheduled for deletion. You have 30 days to cancel.");
      logout();
      navigate("/login");
    } catch (err: unknown) {
      handleApiError(err, { fallback: "Failed to delete account" });
    } finally {
      setLoading(false);
      setDialogOpen(false);
      setConfirmation("");
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="rounded-xl border border-error-border bg-error-bg elevation-1 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-error-text mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-error-text">Delete Account</h3>
          <p className="text-sm text-foreground-muted">
            Permanently delete your account and all associated data. This action schedules your
            account for deletion after a 30-day grace period, during which you can cancel.
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        className="border-error-border text-error-text hover:bg-error-bg hover:text-error-text"
        onClick={() => setDialogOpen(true)}
      >
        Delete Account
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setConfirmation(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-error-text">
              <AlertTriangle className="size-5" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will schedule your account for permanent deletion. All your data — entries,
                  folders, tools, API keys, and billing history — will be permanently removed after
                  30 days.
                </p>
                <p>
                  You can cancel this within the 30-day grace period by signing in again.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="delete-confirm" className="text-foreground">
                    Type <strong>DELETE</strong> to confirm
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="bg-elevated border-border"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!canDelete || loading}
              onClick={handleDelete}
            >
              {loading && <Loader2 className="animate-spin mr-1 size-3" />}
              Delete Account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
