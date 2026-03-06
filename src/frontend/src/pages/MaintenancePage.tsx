import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wrench } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { getSystemStatus } from "@/services/api/superService";

const POLL_INTERVAL = 30_000;

const MaintenancePage = () => {
  const navigate = useNavigate();
  const setMaintenanceMode = useAuthStore((s) => s.setMaintenanceMode);

  useEffect(() => {
    const check = async () => {
      try {
        const status = await getSystemStatus();
        if (!status.maintenance) {
          setMaintenanceMode(false);
          navigate("/", { replace: true });
        }
      } catch {
        // Ignore errors — keep showing maintenance page
      }
    };

    check(); // Check immediately on mount
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [navigate, setMaintenanceMode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="mx-auto max-w-md text-center space-y-6 p-8">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-warning-bg">
          <Wrench className="size-8 text-warning-text" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Clarive is undergoing maintenance
        </h1>
        <p className="text-foreground-muted">
          We're performing scheduled maintenance to improve your experience.
          Please try again in a few minutes.
        </p>
        <p className="text-xs text-foreground-muted/60">
          This page will automatically refresh when maintenance is complete.
        </p>
      </div>
    </div>
  );
};

export default MaintenancePage;
