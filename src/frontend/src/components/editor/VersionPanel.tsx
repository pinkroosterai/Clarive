import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { GitCompareArrows } from "lucide-react";
import { toast } from "sonner";

import type { VersionInfo } from "@/types";
import { entryService } from "@/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

const versionBadgeVariant: Record<string, "draft" | "published" | "historical"> = {
  draft: "draft",
  published: "published",
  historical: "historical",
};

interface VersionPanelProps {
  entryId: string;
  versions: VersionInfo[];
  currentVersion?: number;
  isLoading?: boolean;
  onCompare?: () => void;
}

export function VersionPanel({
  entryId,
  versions,
  currentVersion,
  isLoading,
  onCompare,
}: VersionPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const promoteMutation = useMutation({
    mutationFn: () => entryService.promoteVersion(entryId, currentVersion!),
    onSuccess: (promoted) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["versions", entryId] });
      toast.success("Version restored as new draft");
      navigate(`/entry/${promoted.id}`);
    },
    onError: () => toast.error("Failed to promote version"),
  });

  const viewedVersionState = currentVersion
    ? versions.find((v) => v.version === currentVersion)?.versionState
    : undefined;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Version History
        </h3>
        <div className="relative ml-3 border-l-2 border-border-subtle pl-5 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[25px] top-1 size-3 rounded-full bg-elevated" />
              <Skeleton className="h-4 w-16 mb-1.5" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-tour="version-panel">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">Version History</h3>

      <div className="relative ml-3 border-l-2 border-border-subtle pl-5 space-y-1">
        {versions.map((v) => {
          const isActive =
            currentVersion !== undefined
              ? v.version === currentVersion
              : v.version === versions[0]?.version;

          // The working version is the draft (if one exists), otherwise the published version
          const workingVersion =
            versions.find((ver) => ver.versionState === "draft") ??
            versions.find((ver) => ver.versionState === "published");
          const isEditing = !currentVersion && workingVersion?.version === v.version;

          return (
            <button
              key={v.version}
              className={`relative w-full text-left rounded-md px-3 py-2 text-sm transition-colors duration-150 hover:bg-elevated ${
                isActive ? "bg-primary/8" : ""
              }`}
              onClick={() => {
                if (workingVersion && v.version === workingVersion.version) {
                  // Navigate to the editable view (no version in URL)
                  navigate(`/entry/${entryId}`);
                } else {
                  navigate(`/entry/${entryId}/version/${v.version}`);
                }
              }}
            >
              {/* Timeline dot */}
              <div
                className={`absolute -left-[25px] top-3 rounded-full ring-2 ring-background ${
                  isActive ? "size-3 bg-primary glow-brand-sm" : "size-2.5 bg-foreground-muted/40"
                }`}
              />

              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  v{v.version}
                  {isEditing && <span className="ml-1.5 italic font-normal text-foreground-muted">(editing)</span>}
                </span>
                <Badge
                  variant={versionBadgeVariant[v.versionState] ?? "historical"}
                >
                  {v.versionState.charAt(0).toUpperCase() +
                    v.versionState.slice(1)}
                </Badge>
              </div>
              {v.publishedAt && (
                <p className="text-xs text-foreground-muted mt-0.5">
                  {format(new Date(v.publishedAt), "MMM d, yyyy")}
                  {v.publishedBy && ` by ${v.publishedBy}`}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {versions.length >= 2 && onCompare && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={onCompare}
        >
          <GitCompareArrows className="size-3.5" />
          Compare versions
        </Button>
      )}

      {currentVersion && viewedVersionState === "historical" && (() => {
        const hasDraft = versions.some((v) => v.versionState === "draft");
        const draftVersion = versions.find((v) => v.versionState === "draft")?.version;

        return (
          <div className="pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={promoteMutation.isPending}
                >
                  {promoteMutation.isPending
                    ? "Restoring…"
                    : "Restore as draft"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore this version?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {hasDraft
                      ? `This will replace your current draft (v${draftVersion}) with the content from v${currentVersion}. Continue?`
                      : `This will create a new draft based on v${currentVersion}. You can edit it before publishing.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => promoteMutation.mutate()}>
                    Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      })()}
    </div>
  );
}
