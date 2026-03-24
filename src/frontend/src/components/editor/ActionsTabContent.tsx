import {
  Copy,
  GitCompareArrows,
  MoreHorizontal,
  Play,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';

import { EditActions } from './EditActions';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import type { VersionInfo } from '@/types';

export interface ActionsTabContentProps {
  isDirty: boolean;
  isReadOnly: boolean;
  onSave: () => void;
  onDiscard: () => void;
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
  onCompareVersions?: () => void;
  versions: VersionInfo[];
  entryVersion: number;
  onShare?: () => void;
  hasShareLink?: boolean;
  hasEmptyTitle?: boolean;
  onDuplicate?: () => void;
  isDuplicating?: boolean;
  onMoveToTrash?: () => void;
  isMovingToTrash?: boolean;
}

export function ActionsTabContent({
  isDirty,
  isReadOnly,
  onSave,
  onDiscard,
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
  onCompareVersions,
  versions,
  entryVersion,
  onShare,
  hasShareLink,
  hasEmptyTitle,
  onDuplicate,
  isDuplicating,
  onMoveToTrash,
  isMovingToTrash,
}: ActionsTabContentProps) {
  const aiEnabled = useAiEnabled();
  const hasPublished = versions.some((v) => v.versionState === 'published');
  const publishedVersion = versions.find((v) => v.versionState === 'published')?.version;

  // State-controlled dialogs for items inside the dropdown
  const [showDecomposeConfirm, setShowDecomposeConfirm] = useState(false);
  const [showTrashConfirm, setShowTrashConfirm] = useState(false);

  if (isReadOnly) {
    return (
      <div className="py-4 text-center text-sm text-foreground-muted">
        Read-only mode — no actions available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Actions</h3>
      </div>

      {/* Edit — always visible */}
      <div className="space-y-1.5">
        <EditActions
          isDirty={isDirty}
          onSave={onSave}
          onDiscard={onDiscard}
          isSaving={isSaving}
          hasEmptyTitle={hasEmptyTitle}
        />
      </div>

      <Separator />

      {/* Publish — always visible */}
      <AlertDialog>
        <Tooltip>
          <AlertDialogTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="w-full gap-2 hover:border-primary/30 transition-all"
                disabled={isPublishing || hasEmptyTitle}
              >
                <Upload className="size-4" />
                Publish
              </Button>
            </TooltipTrigger>
          </AlertDialogTrigger>
          <TooltipContent side="left">
            {hasEmptyTitle ? (
              'Title is required to publish'
            ) : (
              <kbd className="text-xs">Ctrl+Enter</kbd>
            )}
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

      {/* AI Tools — visible buttons */}
      {(aiEnabled || showGenerateSystemMessage || showDecomposeToChain) && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              AI Tools
            </h3>
            <Button
              variant="outline"
              className="w-full gap-2 hover:border-primary/30 transition-all"
              onClick={onEnhance}
              disabled={!aiEnabled}
            >
              <Sparkles className="size-4" />
              AI Enhance
            </Button>

            {onTest && (
              <Button
                variant="outline"
                className="w-full gap-2 hover:border-primary/30 transition-all"
                onClick={onTest}
                disabled={!aiEnabled}
              >
                <Play className="size-4" />
                Run Prompt
              </Button>
            )}

            {showGenerateSystemMessage && (
              <Button
                variant="outline"
                className="w-full gap-2 hover:border-primary/30 transition-all"
                onClick={onGenerateSystemMessage}
                disabled={isGeneratingSystemMessage || !aiEnabled}
              >
                <Wand2 className="size-4" />
                {isGeneratingSystemMessage ? 'Generating...' : 'Generate System Message'}
              </Button>
            )}

            {showDecomposeToChain && (
              <Button
                variant="outline"
                className="w-full gap-2 hover:border-primary/30 transition-all"
                onClick={() => setShowDecomposeConfirm(true)}
                disabled={isDecomposing || !aiEnabled}
              >
                <Workflow className="size-4" />
                {isDecomposing ? 'Decomposing...' : 'Decompose to Chain'}
              </Button>
            )}

            {onCompareVersions && (
              <Button
                variant="outline"
                className="w-full gap-2 hover:border-primary/30 transition-all"
                onClick={onCompareVersions}
                disabled={!aiEnabled}
              >
                <GitCompareArrows className="size-4" />
                Compare Versions
              </Button>
            )}
          </div>
        </>
      )}

      {/* More actions — dropdown for utility actions */}
      <Separator />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full gap-2">
            <MoreHorizontal className="size-4" />
            More actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {onShare && hasPublished && (
            <DropdownMenuItem onClick={onShare}>
              <Share2 className="size-4 mr-2" />
              {hasShareLink ? 'Manage Share Link' : 'Share Link'}
            </DropdownMenuItem>
          )}

          {onDuplicate && (
            <DropdownMenuItem onClick={onDuplicate} disabled={isDuplicating}>
              <Copy className="size-4 mr-2" />
              {isDuplicating ? 'Duplicating...' : 'Duplicate'}
            </DropdownMenuItem>
          )}

          {onMoveToTrash && (
            <>
              {(onShare || onDuplicate) && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={() => setShowTrashConfirm(true)}
                disabled={isMovingToTrash}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
                {isMovingToTrash ? 'Moving...' : 'Move to Trash'}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* State-controlled confirmation dialogs (rendered outside dropdown) */}
      <AlertDialog open={showDecomposeConfirm} onOpenChange={setShowDecomposeConfirm}>
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

      <AlertDialog open={showTrashConfirm} onOpenChange={setShowTrashConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This entry will be moved to trash. You can restore it later from the Trash page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onMoveToTrash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
