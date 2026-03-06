import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, AlertTriangle, Check, Minus, Save, Server, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { setConfigValue, resetConfigValue, type ConfigSetting } from "@/services/api/configService";
import { handleApiError } from "@/lib/handleApiError";
import { toast } from "sonner";

const RESTART_STORAGE_KEY = "cl_pending_restart_keys";

function addRestartKey(key: string) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(RESTART_STORAGE_KEY) || "[]") as string[];
    if (!existing.includes(key)) {
      existing.push(key);
      sessionStorage.setItem(RESTART_STORAGE_KEY, JSON.stringify(existing));
    }
  } catch {
    sessionStorage.setItem(RESTART_STORAGE_KEY, JSON.stringify([key]));
  }
}

interface ConfigSectionFormProps {
  settings: ConfigSetting[];
  onSaved: () => void;
}

export default function ConfigSectionForm({ settings, onSaved }: ConfigSectionFormProps) {
  const queryClient = useQueryClient();
  const [dirtyValues, setDirtyValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const resetMutation = useMutation({
    mutationFn: (key: string) => resetConfigValue(key),
    onSuccess: (_data, key) => {
      toast.success(`Reset to default: ${settings.find((s) => s.key === key)?.label ?? key}`);
      setDirtyValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["super", "config"] });
    },
    onError: (err) => handleApiError(err, { fallback: "Failed to reset setting" }),
  });

  const handleChange = (key: string, newValue: string, originalValue: string | null, isSecret: boolean) => {
    if (!isSecret && newValue === (originalValue ?? "")) {
      setDirtyValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else if (isSecret && newValue === "") {
      setDirtyValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setDirtyValues((prev) => ({ ...prev, [key]: newValue }));
    }
  };

  const hasDirty = Object.keys(dirtyValues).length > 0;

  const handleSave = async () => {
    if (!hasDirty) return;
    setSaving(true);
    let savedCount = 0;
    let hadRestartRequired = false;

    try {
      for (const [key, value] of Object.entries(dirtyValues)) {
        const result = await setConfigValue(key, value);
        savedCount++;
        if (result.requiresRestart) {
          hadRestartRequired = true;
          addRestartKey(key);
        }
      }

      setDirtyValues({});
      queryClient.invalidateQueries({ queryKey: ["super", "config"] });

      if (hadRestartRequired) {
        toast.success(`${savedCount} setting${savedCount > 1 ? "s" : ""} saved. Some changes require a restart to take effect.`, {
          duration: 6000,
        });
      } else {
        toast.success(`${savedCount} setting${savedCount > 1 ? "s" : ""} saved`);
      }

      onSaved();
    } catch (err) {
      handleApiError(err, { fallback: "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1">
      {settings.map((setting, index) => (
        <div key={setting.key}>
          {index > 0 && <Separator className="my-4" />}
          <ConfigField
            setting={setting}
            dirtyValue={dirtyValues[setting.key]}
            onChange={(value) => handleChange(setting.key, value, setting.value, setting.isSecret)}
            onReset={() => resetMutation.mutate(setting.key)}
            isResetting={resetMutation.isPending && resetMutation.variables === setting.key}
          />
        </div>
      ))}

      <div className="pt-4">
        <Button onClick={handleSave} disabled={!hasDirty || saving} size="sm">
          <Save className="size-4 mr-1.5" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

interface ConfigFieldProps {
  setting: ConfigSetting;
  dirtyValue: string | undefined;
  onChange: (value: string) => void;
  onReset: () => void;
  isResetting: boolean;
}

function ConfigField({ setting, dirtyValue, onChange, onReset, isResetting }: ConfigFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{setting.label}</Label>
        {setting.requiresRestart && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-warning-text border-warning-border gap-1 text-xs">
                  <AlertTriangle className="size-3" />
                  Restart
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Requires application restart to take effect</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <SourceBadge source={setting.source} />
      </div>

      <p className="text-xs text-foreground-muted">{setting.description}</p>

      <div className="flex items-center gap-2">
        {setting.isSecret ? (
          <SecretInput setting={setting} dirtyValue={dirtyValue} onChange={onChange} />
        ) : (
          <Input
            type="text"
            value={dirtyValue ?? setting.value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={setting.validationHint ?? ""}
            className="max-w-md"
          />
        )}

        {setting.source === "dashboard" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onReset}
                  disabled={isResetting}
                  className="shrink-0"
                >
                  <RotateCcw className={`size-4 ${isResetting ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove dashboard override and revert to environment default</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {setting.validationHint && !setting.isSecret && (
        <p className="text-xs text-foreground-muted/70">{setting.validationHint}</p>
      )}
    </div>
  );
}

interface SecretInputProps {
  setting: ConfigSetting;
  dirtyValue: string | undefined;
  onChange: (value: string) => void;
}

function SecretInput({ setting, dirtyValue, onChange }: SecretInputProps) {
  return (
    <div className="flex items-center gap-3 max-w-md w-full">
      <Input
        type="password"
        value={dirtyValue ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={setting.validationHint ?? "Enter new value..."}
        className="flex-1"
      />
    </div>
  );
}

function SourceBadge({ source }: { source: ConfigSetting["source"] }) {
  switch (source) {
    case "dashboard":
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-info-text border-info-border gap-1 text-xs">
                <Database className="size-3" />
                Dashboard
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Value set via the super user dashboard (overrides environment)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case "environment":
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-success-text border-success-border gap-1 text-xs">
                <Server className="size-3" />
                Environment
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Value provided by environment variable</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case "none":
    default:
      return (
        <Badge variant="outline" className="text-foreground-muted border-foreground-muted/30 gap-1 text-xs">
          <Minus className="size-3" />
          Not configured
        </Badge>
      );
  }
}
