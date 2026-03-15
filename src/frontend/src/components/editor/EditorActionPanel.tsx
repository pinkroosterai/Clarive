import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
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
  Check,
  History,
  Play,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { ActivityTimeline } from '@/components/editor/ActivityTimeline';
import { TagEditor } from '@/components/editor/TagEditor';
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
import { useAiEnabled } from '@/hooks/useAiEnabled';
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
  onTest?: () => void;
  versions: VersionInfo[];
  versionPanel?: ReactNode;
}

function ActionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
        {label}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
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
  onTest,
  versions,
  versionPanel,
}: EditorActionPanelProps) {
  const aiEnabled = useAiEnabled();
  const hasDraft = versions.some((v) => v.versionState === 'draft');
  const publishedVersion = versions.find((v) => v.versionState === 'published')?.version;

  const [showActivity, setShowActivity] = useState(false);

  // Save success feedback
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const wasSaving = useRef(false);
  useEffect(() => {
    if (wasSaving.current && !isSaving) {
      setShowSaveSuccess(true);
      const t = setTimeout(() => setShowSaveSuccess(false), 1500);
      return () => clearTimeout(t);
    }
    wasSaving.current = isSaving;
  }, [isSaving]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {!isReadOnly && (
        <>
          <ActionGroup label="Edit">
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
                <Button
                  className="w-full gap-2"
                  onClick={onSave}
                  disabled={(!isDirty && !showSaveSuccess) || isSaving}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {showSaveSuccess ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        <Check className="size-4 text-success-text" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="save"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                      >
                        <Save className="size-4" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {showSaveSuccess ? 'Saved!' : isSaving ? 'Saving\u2026' : 'Save Draft'}
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
          </ActionGroup>

          <Separator />

          <ActionGroup label="Publish">
            <AlertDialog>
              <Tooltip>
                <AlertDialogTrigger asChild>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <Button
                        variant="outline"
                        className="w-full gap-2 hover:border-primary/30 transition-all"
                        disabled={isPublishing || !hasDraft}
                      >
                        <Upload className="size-4" />
                        Publish
                      </Button>
                      {hasDraft && !isDirty && (
                        <motion.div
                          className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary"
                          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </div>
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
          </ActionGroup>

          {(aiEnabled || showGenerateSystemMessage || showDecomposeToChain) && (
            <>
              <Separator />

              <ActionGroup label="AI Tools">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        className="w-full gap-2 hover:border-primary/30 transition-all"
                        onClick={onEnhance}
                        disabled={!aiEnabled}
                      >
                        <Sparkles className="size-4" />
                        AI Enhance
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!aiEnabled && (
                    <TooltipContent side="left">AI features are not configured</TooltipContent>
                  )}
                </Tooltip>

                {showGenerateSystemMessage && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 hover:border-primary/30 transition-all"
                    onClick={onGenerateSystemMessage}
                    disabled={isGeneratingSystemMessage || !aiEnabled}
                  >
                    <Wand2 className="size-4" />
                    {isGeneratingSystemMessage ? 'Generating\u2026' : 'Generate System Message'}
                  </Button>
                )}

                {showDecomposeToChain && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full gap-2 hover:border-primary/30 transition-all"
                        disabled={isDecomposing || !aiEnabled}
                      >
                        <Wand2 className="size-4" />
                        {isDecomposing ? 'Decomposing\u2026' : 'Decompose to Chain'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Decompose to chain?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will split your prompt into a multi-step chain. The original prompt
                          will be preserved as the first step.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDecomposeToChain}>
                          Decompose
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {onTest && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="outline"
                          className="w-full gap-2 hover:border-primary/30 transition-all"
                          onClick={onTest}
                          disabled={!aiEnabled}
                        >
                          <Play className="size-4" />
                          Test Prompt
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!aiEnabled && (
                      <TooltipContent side="left">AI features are not configured</TooltipContent>
                    )}
                  </Tooltip>
                )}
              </ActionGroup>
            </>
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

      <ActionGroup label="Tags">
        <TagEditor entryId={entry.id} readOnly={isReadOnly} />
      </ActionGroup>

      <Separator />

      <ActionGroup label="Metadata">
        <div className="space-y-2.5 text-sm">
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
      </ActionGroup>

      <Separator />

      <ActionGroup label="Folder">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground-muted">{folderName}</span>
          {!isReadOnly && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onMoveFolder}>
              <FolderInput className="size-3.5" /> Move
            </Button>
          )}
        </div>
      </ActionGroup>

      <Separator />

      <ActionGroup label="Activity">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 w-full justify-start"
          onClick={() => setShowActivity(!showActivity)}
        >
          <History className="size-3.5" />
          {showActivity ? 'Hide activity' : 'Show activity'}
        </Button>
        {showActivity && <ActivityTimeline entryId={entry.id} />}
      </ActionGroup>
    </motion.div>
  );
}
