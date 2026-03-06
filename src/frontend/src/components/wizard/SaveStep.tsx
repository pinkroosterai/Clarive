import { useState } from "react";
import { Loader2, Save, FolderInput } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import type { PromptEntry } from "@/types";
import { folderService } from "@/services";
import { findFolderName } from "@/lib/folderUtils";
import { FolderPickerDialog } from "@/components/library/FolderPickerDialog";
import { Button } from "@/components/ui/button";

interface SaveStepProps {
  draft: PromptEntry;
  mode: "new" | "enhance";
  onSave: (folderId: string | null) => void;
  isSaving: boolean;
}

export function SaveStep({ draft, mode, onSave, isSaving }: SaveStepProps) {
  const [folderId, setFolderId] = useState<string | null>(draft.folderId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: folderService.getFoldersTree,
    enabled: mode === "new",
  });

  const folderName = findFolderName(folders, folderId);

  return (
    <div className="space-y-6 text-center">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">
          {mode === "new" ? "Save as new draft entry?" : "Apply enhanced version to current entry?"}
        </h3>
        <p className="text-sm text-foreground-muted">
          <span className="font-medium text-foreground">{draft.title}</span>
        </p>
      </div>

      {mode === "new" && (
        <div className="flex items-center justify-center gap-3 bg-elevated border-border rounded-lg px-4 py-3 mx-auto w-fit">
          <span className="text-sm text-foreground-muted">Folder: {folderName}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPickerOpen(true)}>
            <FolderInput className="size-3.5" />
            Change
          </Button>
          <FolderPickerDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={(id) => {
              setFolderId(id);
              setPickerOpen(false);
            }}
          />
        </div>
      )}

      <Button className="w-full gap-2 py-3" onClick={() => onSave(folderId)} disabled={isSaving}>
        {isSaving ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save className="size-4" />
            {mode === "new" ? "Save" : "Apply"}
          </>
        )}
      </Button>
    </div>
  );
}
