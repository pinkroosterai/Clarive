import { useState } from "react";
import { Mail, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services";
import { Button } from "@/components/ui/button";

export function EmailVerificationBanner() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("email-banner-dismissed") === "true"
  );

  if (!currentUser || currentUser.emailVerified || dismissed) return null;

  const handleResend = async () => {
    setLoading(true);
    try {
      await authService.resendVerification();
      toast.success("Verification email sent. Check your inbox.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send verification email";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-warning-bg border-b border-warning-border px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-warning-text">
        <Mail className="size-4 shrink-0" />
        <span>Verify your email to unlock AI features.</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-warning-text hover:text-foreground hover:bg-warning-bg"
          disabled={loading}
          onClick={handleResend}
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin mr-1" />
          ) : null}
          Resend verification email
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-warning-text hover:text-foreground hover:bg-warning-bg"
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem("email-banner-dismissed", "true");
        }}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
