import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Folder, FolderOpen, Home } from "lucide-react";

import { folderService } from "@/services";
import type { Folder as FolderType } from "@/types";
import { cn } from "@/lib/utils";
import { collectDescendantIds, findFolder } from "@/lib/dnd/validation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ── PickerNode ───────────────────────────────────────────────────────────────
function PickerNode({
  folder,
  depth,
  excludeIds,
  selectedId,
  onSelect,
}: {
  folder: FolderType;
  depth: number;
  excludeIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (excludeIds.has(folder.id)) return null;

  const isSelected = selectedId === folder.id;
  const hasVisibleChildren = folder.children.some((c) => !excludeIds.has(c.id));
  const FolderIcon = isOpen ? FolderOpen : Folder;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md py-1 pr-2 cursor-pointer hover:bg-accent",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(folder.id)}
      >
        <CollapsibleTrigger asChild>
          <button
            className="flex size-5 shrink-0 items-center justify-center rounded-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <ChevronRight
              className={cn(
                "size-3.5 text-foreground-muted transition-transform duration-200",
                isOpen && "rotate-90",
                !hasVisibleChildren && "invisible"
              )}
            />
          </button>
        </CollapsibleTrigger>
        <FolderIcon className="size-4 shrink-0 text-foreground-muted" />
        <span className="truncate text-sm">{folder.name}</span>
      </div>

      <CollapsibleContent>
        {folder.children.map((child) => (
          <PickerNode
            key={child.id}
            folder={child}
            depth={depth + 1}
            excludeIds={excludeIds}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── FolderPickerDialog ───────────────────────────────────────────────────────
interface FolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeFolderId?: string;
  onSelect: (folderId: string | null) => void;
}

export function FolderPickerDialog({
  open,
  onOpenChange,
  excludeFolderId,
  onSelect,
}: FolderPickerDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedId(null);
  }, [open]);

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: folderService.getFoldersTree,
    enabled: open,
  });

  const excludeIds = excludeFolderId
    ? (() => {
        const folder = findFolder(folders, excludeFolderId);
        return folder ? collectDescendantIds(folder) : new Set<string>();
      })()
    : new Set<string>();

  const isRootSelected = selectedId === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to…</DialogTitle>
          <DialogDescription>Select a destination folder.</DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto rounded-md border p-2">
          {/* Root option */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent text-sm",
              isRootSelected && "bg-primary/10 text-primary"
            )}
            onClick={() => setSelectedId(null)}
          >
            <Home className="size-4 text-foreground-muted" />
            <span>Root</span>
          </div>

          {folders.map((folder) => (
            <PickerNode
              key={folder.id}
              folder={folder}
              depth={0}
              excludeIds={excludeIds}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
            />
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSelect(selectedId)}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
