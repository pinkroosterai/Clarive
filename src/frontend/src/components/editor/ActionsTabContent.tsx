import { AnimatePresence, motion } from 'framer-motion';
import {
  Save,
  Upload,
  Sparkles,
  Wand2,
  RotateCcw,
  Trash2,
  Undo2,
  Redo2,
  Check,
  Play,
  Share2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useEffect, useRef } from 'react';

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
import type { VersionInfo } from '@/types';

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

export interface ActionsTabContentProps {
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
  onGenerateSystemMessage: () => void;
  onDecomposeToChain: () => void;
  isGeneratingSystemMessage: boolean;
  isDecomposing: boolean;
  showGenerateSystemMessage: boolean;
  showDecomposeToChain: boolean;
  onTest?: () => void;
  versions: VersionInfo[];
  entryVersion: number;
  onDeleteDraft?: () => void;
  isDeletingDraft?: boolean;
  onShare?: () => void;
  hasShareLink?: boolean;
  hasEmptyTitle?: boolean;
}

export function ActionsTabContent({
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
  onGenerateSystemMessage,
  onDecomposeToChain,
  isGeneratingSystemMessage,
  isDecomposing,
  showGenerateSystemMessage,
  showDecomposeToChain,
  onTest,
  versions,
  entryVersion,
  onDeleteDraft,
  isDeletingDraft,
  onShare,
  hasShareLink,
  hasEmptyTitle,
}: ActionsTabContentProps) {
  const aiEnabled = useAiEnabled();
  const hasDraft = versions.some((v) => v.versionState === 'draft');
  const hasPublished = versions.some((v) => v.versionState === 'published');
  const publishedVersion = versions.find((v) => v.versionState === 'published')?.version;

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

  if (isReadOnly) {
    return (
      <div className="py-4 text-center text-sm text-foreground-muted">
        Read-only mode — no actions available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
              disabled={(!isDirty && !showSaveSuccess) || isSaving || hasEmptyTitle}
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

        {hasEmptyTitle && isDirty && (
          <p className="text-xs text-destructive">Title is required</p>
        )}

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

        {onDeleteDraft && hasDraft && hasPublished && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full gap-2 text-destructive hover:text-destructive"
                disabled={isDeletingDraft}
              >
                <Trash2 className="size-4" />
                {isDeletingDraft ? 'Deleting\u2026' : 'Delete Draft'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the current draft and revert to the published
                  version. Draft content cannot be recovered.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDeleteDraft}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Draft
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
                  ? `Publishing will make v${entryVersion} the active published version. The current published version (v${publishedVersion}) will become historical.`
                  : `This will publish v${entryVersion} as the first published version.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onPublish}>Publish</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ActionGroup>

      {onShare && hasPublished && (
        <>
          <Separator />
          <ActionGroup label="Share">
            <Button
              variant="outline"
              className="w-full gap-2 hover:border-primary/30 transition-all"
              onClick={onShare}
            >
              <Share2 className="size-4" />
              {hasShareLink ? 'Manage Share Link' : 'Share Link'}
            </Button>
          </ActionGroup>
        </>
      )}

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
                      This will split your prompt into a multi-step chain. The original prompt will
                      be preserved as the first step.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDecomposeToChain}>Decompose</AlertDialogAction>
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
    </div>
  );
}
