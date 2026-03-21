import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { ActionsTabContent } from '@/components/editor/ActionsTabContent';
import { DetailsTabContent } from '@/components/editor/DetailsTabContent';
import { QualityTabContent } from '@/components/editor/QualityTabContent';
import { VersionsTabContent } from '@/components/editor/VersionsTabContent';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Evaluation, PromptEntry, VersionInfo } from '@/types';

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
  onDeleteDraft?: () => void;
  isDeletingDraft?: boolean;
  onShare?: () => void;
  hasShareLink?: boolean;
  hasEmptyTitle?: boolean;
  localEvaluation?: Evaluation | null;
  isEvaluating?: boolean;
  onEvaluate?: () => void;
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
  onDeleteDraft,
  isDeletingDraft,
  onShare,
  hasShareLink,
  hasEmptyTitle,
  localEvaluation,
  isEvaluating,
  onEvaluate,
}: EditorActionPanelProps) {
  const [activeTab, setActiveTab] = useState('actions');

  const hasDraft = versions.some((v) => v.versionState === 'draft');
  const tagCount = entry.tags?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="h-full flex flex-col"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="w-full shrink-0">
          <TabsTrigger value="actions" className="flex-1 gap-1.5 text-xs">
            Actions
            {isDirty && !isReadOnly && (
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="details" className="flex-1 gap-1.5 text-xs">
            Details
            {tagCount > 0 && (
              <span className="inline-flex items-center justify-center size-4 rounded-full bg-muted-foreground/20 text-[10px] font-medium text-muted-foreground">
                {tagCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="versions" className="flex-1 gap-1.5 text-xs">
            Versions
            <span className="text-[10px] font-medium text-muted-foreground">v{entry.version}</span>
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex-1 gap-1.5 text-xs">
            Quality
            {(localEvaluation || entry.evaluation) && (
              <span className="inline-flex items-center justify-center size-4 rounded-full bg-muted-foreground/20 text-[10px] font-medium text-muted-foreground">
                {Math.round(
                  localEvaluation
                    ? Object.values(localEvaluation.dimensions).reduce(
                        (s, e) => s + e.score,
                        0
                      ) / Object.keys(localEvaluation.dimensions).length
                    : (entry.evaluationAverageScore ?? 0)
                )}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="flex-1 overflow-hidden pt-4">
          <ScrollArea className="h-full">
            <ActionsTabContent
              isDirty={isDirty}
              isReadOnly={isReadOnly}
              onSave={onSave}
              onDiscard={onDiscard}
              onUndo={onUndo}
              onRedo={onRedo}
              canUndo={canUndo}
              canRedo={canRedo}
              onPublish={onPublish}
              onEnhance={onEnhance}
              isSaving={isSaving}
              isPublishing={isPublishing}
              onGenerateSystemMessage={onGenerateSystemMessage}
              onDecomposeToChain={onDecomposeToChain}
              isGeneratingSystemMessage={isGeneratingSystemMessage}
              isDecomposing={isDecomposing}
              showGenerateSystemMessage={showGenerateSystemMessage}
              showDecomposeToChain={showDecomposeToChain}
              onTest={onTest}
              versions={versions}
              entryVersion={entry.version}
              onDeleteDraft={onDeleteDraft}
              isDeletingDraft={isDeletingDraft}
              onShare={onShare}
              hasShareLink={hasShareLink}
              hasEmptyTitle={hasEmptyTitle}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="details" className="flex-1 overflow-hidden pt-4">
          <ScrollArea className="h-full">
            <DetailsTabContent
              entry={entry}
              folderName={folderName}
              onMoveFolder={onMoveFolder}
              isReadOnly={isReadOnly}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="versions" className="flex-1 overflow-hidden pt-4">
          <ScrollArea className="h-full">
            {versionPanel ? (
              <VersionsTabContent versionPanel={versionPanel} />
            ) : (
              <div className="py-4 text-center text-sm text-foreground-muted">
                No version data available.
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="quality" className="flex-1 overflow-hidden pt-4">
          <ScrollArea className="h-full">
            <QualityTabContent
              evaluation={entry.evaluation}
              localEvaluation={localEvaluation}
              isDirty={isDirty}
              isEvaluating={isEvaluating ?? false}
              onEvaluate={onEvaluate ?? (() => {})}
              versions={versions}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
