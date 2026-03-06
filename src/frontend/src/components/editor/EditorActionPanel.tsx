import { format } from 'date-fns';
import {
  Save,
  Upload,
  Sparkles,
  FolderInput,
  Clock,
  User,
  Calendar,
  Wand2,
  RotateCcw,
  Undo2,
  Redo2,
  Copy,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyToClipboard } from '@/lib/utils';
import type { PromptEntry, VersionInfo } from '@/types';

export interface EditorActionPanelProps {
  entry: PromptEntry;
  isDirty: boolean;
  isReadOnly: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onPublish: () => void;
  onEnhance: () => void;
  isSaving: boolean;
  isPublishing: boolean;
  folderName: string;
  onMoveFolder: () => void;
  onGenerateSystemMessage: () => void;
  onDecomposeToChain: () => void;
  isGeneratingSystemMessage: boolean;
  isDecomposing: boolean;
  showGenerateSystemMessage: boolean;
  showDecomposeToChain: boolean;
  versions: VersionInfo[];
  versionPanel?: ReactNode;
}

export function EditorActionPanel({
  entry,
  isDirty,
  isReadOnly,
  onSave,
  onDiscard,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onPublish,
  onEnhance,
  isSaving,
  isPublishing,
  folderName,
  onMoveFolder,
  onGenerateSystemMessage,
  onDecomposeToChain,
  isGeneratingSystemMessage,
  isDecomposing,
  showGenerateSystemMessage,
  showDecomposeToChain,
  versions,
  versionPanel,
}: EditorActionPanelProps) {
  const hasDraft = versions.some((v) => v.versionState === 'draft');
  const publishedVersion = versions.find((v) => v.versionState === 'published')?.version;
  return (
    <div className="space-y-4">
      {!isReadOnly && (
        <>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="size-9"
                >
                  <Undo2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Undo <kbd className="ml-1 text-xs opacity-60">Ctrl+Z</kbd>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRedo}
                  disabled={!canRedo}
                  className="size-9"
                >
                  <Redo2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Redo <kbd className="ml-1 text-xs opacity-60">Ctrl+Shift+Z</kbd>
              </TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="w-full gap-2" onClick={onSave} disabled={!isDirty || isSaving}>
                <Save className="size-4" />
                {isSaving ? 'Saving…' : 'Save Draft'}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <kbd className="text-xs">Ctrl+S</kbd>
            </TooltipContent>
          </Tooltip>

          {isDirty && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full gap-2 text-destructive hover:text-destructive"
                >
                  <RotateCcw className="size-4" />
                  Discard Changes
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Discard all changes?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will revert to the last saved state. Unsaved changes cannot be recovered.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDiscard}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Discard
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <AlertDialog>
            <Tooltip>
              <AlertDialogTrigger asChild>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2 hover:border-primary/30 transition-all"
                    disabled={isPublishing || !hasDraft}
                  >
                    <Upload className="size-4" />
                    Publish
                  </Button>
                </TooltipTrigger>
              </AlertDialogTrigger>
              <TooltipContent side="left">
                {hasDraft ? <kbd className="text-xs">Ctrl+Enter</kbd> : 'No draft to publish'}
              </TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publish this entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  {publishedVersion
                    ? `Publishing will make v${entry.version} the active published version. The current published version (v${publishedVersion}) will become historical.`
                    : `This will publish v${entry.version} as the first published version.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onPublish}>Publish</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="outline"
            className="w-full gap-2 hover:border-primary/30 transition-all"
            onClick={onEnhance}
          >
            <Sparkles className="size-4" />
            AI Enhance
          </Button>

          {showGenerateSystemMessage && (
            <Button
              variant="outline"
              className="w-full gap-2 hover:border-primary/30 transition-all"
              onClick={onGenerateSystemMessage}
              disabled={isGeneratingSystemMessage}
            >
              <Wand2 className="size-4" />
              {isGeneratingSystemMessage ? 'Generating…' : 'Generate System Message'}
            </Button>
          )}

          {showDecomposeToChain && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full gap-2 hover:border-primary/30 transition-all"
                  disabled={isDecomposing}
                >
                  <Wand2 className="size-4" />
                  {isDecomposing ? 'Decomposing…' : 'Decompose to Chain'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Decompose to chain?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will split your prompt into a multi-step chain. The original prompt will be
                    preserved as the first step.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDecomposeToChain}>Decompose</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Separator />
        </>
      )}

      {versionPanel && (
        <>
          {versionPanel}
          <Separator />
        </>
      )}

      <div className="space-y-3 text-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Metadata
        </h3>
        <div className="flex items-center gap-2 text-foreground-muted">
          <Calendar className="size-3.5" />
          <span>Created {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
        </div>
        <div className="flex items-center gap-2 text-foreground-muted">
          <Clock className="size-3.5" />
          <span>Modified {format(new Date(entry.updatedAt), "MMM d, yyyy 'at' h:mm a")}</span>
        </div>
        <div className="flex items-center gap-2 text-foreground-muted">
          <User className="size-3.5" />
          <span>{entry.createdBy}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-foreground-muted h-auto p-0 hover:text-foreground"
          onClick={async () => {
            try {
              await copyToClipboard(entry.id);
              toast.success('Entry ID copied to clipboard');
            } catch {
              toast.error('Failed to copy entry ID');
            }
          }}
        >
          <Copy className="size-3.5" />
          <span className="text-sm">Copy Entry ID</span>
        </Button>
      </div>

      <Separator />

      <div className="space-y-2 text-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Folder
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-foreground-muted">{folderName}</span>
          {!isReadOnly && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onMoveFolder}>
              <FolderInput className="size-3.5" /> Move
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
