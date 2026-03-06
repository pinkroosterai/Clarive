import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { AppShell } from "@/components/layout/AppShell";
import { Loader2 } from "lucide-react";

const SuperRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const currentUser = useAuthStore((s) => s.currentUser);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);

  useEffect(() => {
    if (!isInitialized) {
      initializeAuth();
    }
  }, [isInitialized, initializeAuth]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (!isAuthenticated || !currentUser?.isSuperUser) {
    return <Navigate to="/" replace />;
  }

  return <AppShell />;
};

export default SuperRoute;
