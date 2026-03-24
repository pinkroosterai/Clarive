import { motion } from 'framer-motion';
import { Copy, Upload, Share2, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { AiActions } from './AiActions';
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
  onCompareVersions?: () => void;
  versions: VersionInfo[];
  entryVersion: number;
  onShare?: () => void;
  hasShareLink?: boolean;
  hasEmptyTitle?: boolean;
  onDuplicate?: () => void;
  isDuplicating?: boolean;
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
  onCompareVersions,
  versions,
  entryVersion,
  onShare,
  hasShareLink,
  hasEmptyTitle,
  onDuplicate,
  isDuplicating,
}: ActionsTabContentProps) {
  const aiEnabled = useAiEnabled();
  const hasPublished = versions.some((v) => v.versionState === 'published');
  const publishedVersion = versions.find((v) => v.versionState === 'published')?.version;

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

      <ActionGroup label="Edit">
        <EditActions
          isDirty={isDirty}
          onSave={onSave}
          onDiscard={onDiscard}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          isSaving={isSaving}
          hasEmptyTitle={hasEmptyTitle}
        />
      </ActionGroup>

      <Separator />

      <ActionGroup label="Publish">
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

      {onDuplicate && (
        <>
          <Separator />
          <ActionGroup label="More">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full gap-2 hover:border-primary/30 transition-all"
                  onClick={onDuplicate}
                  disabled={isDuplicating}
                >
                  <Copy className="size-4" />
                  {isDuplicating ? 'Duplicating…' : 'Duplicate'}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Create a copy of this entry</TooltipContent>
            </Tooltip>
          </ActionGroup>
        </>
      )}

      {(aiEnabled || showGenerateSystemMessage || showDecomposeToChain) && (
        <>
          <Separator />
          <ActionGroup label="AI Tools">
            <AiActions
              aiEnabled={aiEnabled}
              onEnhance={onEnhance}
              onGenerateSystemMessage={onGenerateSystemMessage}
              onDecomposeToChain={onDecomposeToChain}
              isGeneratingSystemMessage={isGeneratingSystemMessage}
              isDecomposing={isDecomposing}
              showGenerateSystemMessage={showGenerateSystemMessage}
              showDecomposeToChain={showDecomposeToChain}
              onTest={onTest}
              onCompareVersions={onCompareVersions}
            />
          </ActionGroup>
        </>
      )}
    </div>
  );
}
