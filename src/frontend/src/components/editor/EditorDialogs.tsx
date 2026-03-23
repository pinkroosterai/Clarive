import { ConflictResolutionDialog } from '@/components/editor/ConflictResolutionDialog';
import { ShareDialog } from '@/components/editor/ShareDialog';
import { VersionDiffDialog } from '@/components/editor/VersionDiffDialog';
import { FolderPickerDialog } from '@/components/library/FolderPickerDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ConflictState } from '@/hooks/useEditorMutations';
import type { VersionInfo } from '@/types';

interface EditorDialogsProps {
  entryId: string;
  versions: VersionInfo[];
  versionNum: number | undefined;

  // Folder picker (move)
  folderPickerOpen: boolean;
  onFolderPickerOpenChange: (open: boolean) => void;
  onFolderSelect: (folderId: string) => void;

  // Version diff
  diffOpen: boolean;
  onDiffOpenChange: (open: boolean) => void;

  // Share
  shareDialogOpen: boolean;
  onShareDialogOpenChange: (open: boolean) => void;

  // Duplicate folder picker
  dupFolderPickerOpen: boolean;
  onDupFolderPickerOpenChange: (open: boolean) => void;
  onDupFolderSelect: (folderId: string) => void;

  // Conflict resolution
  conflictState: ConflictState | null;
  onDismissConflict: () => void;
  onResolveConflict: (entry: import('@/types').PromptEntry) => void;

  // Empty publish warning
  showEmptyPublishWarning: boolean;
  onEmptyPublishWarningChange: (open: boolean) => void;
  onPublishAnyway: () => void;

  // Navigation guard
  blockerState: 'blocked' | 'unblocked' | 'proceeding';
  onBlockerReset: (() => void) | undefined;
  onBlockerProceed: (() => void) | undefined;
}

export function EditorDialogs({
  entryId,
  versions,
  versionNum,
  folderPickerOpen,
  onFolderPickerOpenChange,
  onFolderSelect,
  diffOpen,
  onDiffOpenChange,
  shareDialogOpen,
  onShareDialogOpenChange,
  dupFolderPickerOpen,
  onDupFolderPickerOpenChange,
  onDupFolderSelect,
  conflictState,
  onDismissConflict,
  onResolveConflict,
  showEmptyPublishWarning,
  onEmptyPublishWarningChange,
  onPublishAnyway,
  blockerState,
  onBlockerReset,
  onBlockerProceed,
}: EditorDialogsProps) {
  return (
    <>
      <FolderPickerDialog
        open={folderPickerOpen}
        onOpenChange={onFolderPickerOpenChange}
        onSelect={onFolderSelect}
      />
      <VersionDiffDialog
        entryId={entryId}
        versions={versions}
        currentVersion={versionNum}
        open={diffOpen}
        onOpenChange={onDiffOpenChange}
      />
      <ShareDialog
        entryId={entryId}
        open={shareDialogOpen}
        onOpenChange={onShareDialogOpenChange}
      />
      <FolderPickerDialog
        open={dupFolderPickerOpen}
        onOpenChange={onDupFolderPickerOpenChange}
        onSelect={onDupFolderSelect}
      />
      {conflictState && (
        <ConflictResolutionDialog
          open={!!conflictState}
          onOpenChange={(open) => {
            if (!open) onDismissConflict();
          }}
          localEntry={conflictState.localEntry}
          serverEntry={conflictState.serverEntry}
          onResolve={onResolveConflict}
        />
      )}

      {/* Empty-content publish warning */}
      <AlertDialog open={showEmptyPublishWarning} onOpenChange={onEmptyPublishWarningChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish empty entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This entry has no prompt content. Are you sure you want to publish it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onPublishAnyway}>Publish anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsaved changes navigation guard */}
      <AlertDialog open={blockerState === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => onBlockerReset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => onBlockerProceed?.()}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
