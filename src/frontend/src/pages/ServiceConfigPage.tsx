import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert, AlertTriangle, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllConfig, type ConfigSetting } from "@/services/api/configService";
import ConfigSectionForm from "@/components/super/ConfigSectionForm";

const SECTIONS = [
  { key: "Authentication", label: "Authentication" },
  { key: "Ai", label: "AI" },
  { key: "Payments", label: "Payments" },
  { key: "Email", label: "Email" },
  { key: "Monitoring", label: "Monitoring" },
  { key: "Application", label: "Application" },
] as const;

const VALID_TABS = SECTIONS.map((s) => s.key.toLowerCase());
const RESTART_STORAGE_KEY = "cl_pending_restart_keys";

const TAB_STYLE =
  "gap-1.5 min-h-[44px] text-foreground-muted hover:text-foreground-secondary data-[state=active]:bg-surface data-[state=active]:elevation-1 data-[state=active]:rounded-md data-[state=active]:text-foreground";

const ServiceConfigPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : "authentication";

  const [restartKeys, setRestartKeys] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Clarive — Service Configuration";
  }, []);

  // Load restart-required keys from sessionStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(RESTART_STORAGE_KEY) || "[]") as string[];
      setRestartKeys(stored);
    } catch {
      setRestartKeys([]);
    }
  }, []);

  const refreshRestartKeys = () => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(RESTART_STORAGE_KEY) || "[]") as string[];
      setRestartKeys(stored);
    } catch {
      setRestartKeys([]);
    }
  };

  const clearRestartKeys = () => {
    sessionStorage.removeItem(RESTART_STORAGE_KEY);
    setRestartKeys([]);
  };

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ["super", "config"],
    queryFn: getAllConfig,
  });

  const settingsBySection = useMemo(() => {
    if (!settings) return {} as Record<string, ConfigSetting[]>;
    return settings.reduce(
      (acc, setting) => {
        const section = setting.section.toLowerCase();
        if (!acc[section]) acc[section] = [];
        acc[section].push(setting);
        return acc;
      },
      {} as Record<string, ConfigSetting[]>,
    );
  }, [settings]);

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/super">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Service Configuration</h1>
        </div>
      </div>

      {/* Restart Banner */}
      {restartKeys.length > 0 && (
        <Alert className="border-warning-border bg-warning-bg">
          <AlertTriangle className="size-4 text-warning-text" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">
              Settings changed that require a restart to take effect. Restart the backend container to apply.
            </span>
            <Button variant="ghost" size="icon" onClick={clearRestartKeys} className="shrink-0 size-6">
              <X className="size-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>
            Failed to load configuration settings. Check that the backend is running and the database migration has been applied.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(tab) => setSearchParams({ tab }, { replace: true })}
          className="w-full"
        >
          <TabsList className="w-full h-auto justify-start flex-wrap bg-elevated rounded-lg p-1">
            {SECTIONS.map(({ key, label }) => (
              <TabsTrigger key={key} value={key.toLowerCase()} className={TAB_STYLE}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {SECTIONS.map(({ key }) => {
            const sectionSettings = settingsBySection[key.toLowerCase()] ?? [];
            return (
              <TabsContent key={key} value={key.toLowerCase()} className="mt-6">
                {sectionSettings.length > 0 ? (
                  <ConfigSectionForm settings={sectionSettings} onSaved={refreshRestartKeys} />
                ) : (
                  <p className="text-sm text-foreground-muted">No settings in this section.</p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
};

export default ServiceConfigPage;
