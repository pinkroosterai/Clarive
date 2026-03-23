import { AnimatePresence, motion } from 'framer-motion';
import { Save, RotateCcw, Trash2, Undo2, Redo2, Check } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface EditActionsProps {
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  hasEmptyTitle?: boolean;
  hasDraft: boolean;
  hasPublished: boolean;
  onDeleteDraft?: () => void;
  isDeletingDraft?: boolean;
}

export function EditActions({
  isDirty,
  onSave,
  onDiscard,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isSaving,
  hasEmptyTitle,
  hasDraft,
  hasPublished,
  onDeleteDraft,
  isDeletingDraft,
}: EditActionsProps) {
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
    <>
      <div className="inline-flex items-center gap-0.5 rounded-md border border-border-subtle p-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              className="size-10 md:size-8"
              aria-label="Undo"
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
              className="size-10 md:size-8"
              aria-label="Redo"
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
          {hasEmptyTitle ? (
            'Title is required to save'
          ) : (
            <>
              Save Draft <kbd className="ml-1 text-xs opacity-60">Ctrl+S</kbd>
            </>
          )}
        </TooltipContent>
      </Tooltip>

      {hasEmptyTitle && isDirty && <p className="text-xs text-destructive">Title is required</p>}

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
                This will permanently delete the current draft and revert to the published version.
                Draft content cannot be recovered.
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
    </>
  );
}
