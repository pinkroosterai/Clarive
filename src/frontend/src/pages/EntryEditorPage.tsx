import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { toast } from 'sonner';

import { FirstUseHint } from '@/components/common/FirstUseHint';
import { HelpLink } from '@/components/common/HelpLink';
import { EditorActionPanel } from '@/components/editor/EditorActionPanel';
import { EditorAiOverlay } from '@/components/editor/EditorAiOverlay';
import { EditorDialogs } from '@/components/editor/EditorDialogs';
import { EditorError, EditorSkeleton } from '@/components/editor/EditorLoadingStates';
import { PromptEditor } from '@/components/editor/PromptEditor';
import { SoftLockBanner } from '@/components/editor/SoftLockBanner';
import { VersionPanel } from '@/components/editor/VersionPanel';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { useDuplicateEntry } from '@/hooks/useDuplicateEntry';
import { useEditorKeyboardShortcuts } from '@/hooks/useEditorKeyboardShortcuts';
import { useEditorMutations } from '@/hooks/useEditorMutations';
import { useEditorState } from '@/hooks/useEditorState';
import { useEvaluation } from '@/hooks/useEvaluation';
import { useFavoriteMutation } from '@/hooks/useFavoriteMutation';
import { usePresence } from '@/hooks/usePresence';
import { usePublishFlow } from '@/hooks/usePublishFlow';
import { findFolderName } from '@/lib/folderUtils';
import { entryService, folderService } from '@/services';
import { ApiError } from '@/services/api/apiClient';
import { getShareLink } from '@/services/api/shareLinkService';
import { useAuthStore } from '@/store/authStore';

const EntryEditorPage = () => {
  const { entryId, version } = useParams<{ entryId: string; version?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentUser = useAuthStore((s) => s.currentUser);

  const versionNum = version ? parseInt(version, 10) : undefined;
  const [softLockOverride, setSoftLockOverride] = useState(false);

  // ── Data fetching ──
  const {
    data: entryData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => entryService.getEntry(entryId!),
    enabled: !!entryId,
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['versions', entryId],
    queryFn: () => entryService.getVersionHistory(entryId!),
    enabled: !!entryId,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
  });

  // ── Hooks ──
  const editor = useEditorState(entryData);
  const {
    isEvaluating,
    pendingEvaluation,
    pendingEvaluationRef,
    handleEvaluate,
    clearPendingEvaluation,
  } = useEvaluation(entryId, editor.localEntryRef);

  const mutations = useEditorMutations({
    entryId,
    localEntryRef: editor.localEntryRef,
    pendingEvaluationRef,
    onSaveSuccess: () => {
      clearPendingEvaluation();
      editor.setIsDirty(false);
      editor.clearHistory();
    },
    onPublishSuccess: () => {
      editor.setIsDirty(false);
      editor.clearHistory();
    },
    handleChange: editor.handleChange,
  });

  // ── Real-time presence & soft lock ──
  const { presenceUsers, activeEditor, onEditorJoinedRef } = usePresence(entryId, editor.isDirty);
  const {
    startDuplicate,
    confirmDuplicate,
    cancelDuplicate,
    folderPickerState: dupFolderPickerState,
    isDuplicating,
  } = useDuplicateEntry();
  const isSoftLocked = !!activeEditor && !softLockOverride;
  const isReadOnly = !!version || currentUser?.role === 'viewer' || isSoftLocked;

  // Reset soft lock override when navigating to a different entry
  useEffect(() => {
    setSoftLockOverride(false);
  }, [entryId]);

  // Toast when another user starts editing while we're editing
  onEditorJoinedRef.current = (user) => {
    toast.info(`${user.name} started editing this prompt`);
  };

  const {
    hasDraft,
    draftVersion,
    promoteMutation,
    deleteDraftMutation,
    showEmptyPublishWarning,
    setShowEmptyPublishWarning,
    handlePublishWithCheck,
  } = usePublishFlow({
    entryId,
    versionNum,
    versions,
    localEntry: editor.localEntry,
    handlePublish: mutations.handlePublish,
  });

  useEditorKeyboardShortcuts({
    isReadOnly,
    onSave: mutations.handleSave,
    onPublish: handlePublishWithCheck,
    onUndo: editor.handleUndo,
    onRedo: editor.handleRedo,
  });

  // ── Navigation guard for unsaved changes ──
  const blocker = useBlocker(editor.isDirty);

  // Warn before closing/refreshing during AI operations
  const isAiRunningEarly = mutations.isGeneratingSystemMessage || mutations.isDecomposing;
  useEffect(() => {
    if (!isAiRunningEarly) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isAiRunningEarly]);

  // ── Favorite toggle ──
  const {
    isFavorited,
    handleToggleFavorite,
    isPending: isFavoritePending,
  } = useFavoriteMutation(entryId, entryData?.isFavorited ?? false);

  // ── Dialog states ──
  const [diffOpen, setDiffOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // ── Share link status (deferred until dialog opens to avoid 404 on unshared entries) ──
  const [shareDialogEverOpened, setShareDialogEverOpened] = useState(false);
  const shareLinkQuery = useQuery({
    queryKey: ['share-link', entryId],
    queryFn: () => getShareLink(entryId!),
    enabled: !!entryId && shareDialogEverOpened,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });
  const aiEnabled = useAiEnabled();

  const folderName = editor.localEntry
    ? findFolderName(folders, editor.localEntry.folderId)
    : 'Root';

  // ── Loading / error ──
  if (isError) return <EditorError />;
  if (isLoading || !editor.localEntry) return <EditorSkeleton isMobile={isMobile} />;

  const localEntry = editor.localEntry;

  // ── Shared elements ──
  const viewedVersionState = versionNum
    ? versions.find((v) => v.version === versionNum)?.versionState
    : undefined;
  const canRestore = viewedVersionState === 'historical' && currentUser?.role !== 'viewer';

  const readOnlyBanner = isReadOnly && version && (
    <div className="flex items-center gap-3 rounded-md border border-warning-border bg-warning-bg px-4 py-2.5 text-sm">
      <AlertTriangle className="size-4 text-warning-text shrink-0" />
      <span className="flex-1 text-warning-text">Viewing v{version} (read-only)</span>
      {canRestore && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={promoteMutation.isPending}
            >
              {promoteMutation.isPending ? 'Restoring…' : 'Restore as draft'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore this version?</AlertDialogTitle>
              <AlertDialogDescription>
                {hasDraft
                  ? `This will replace your current draft (v${draftVersion}) with the content from v${version}. Continue?`
                  : `This will create a new draft based on v${version}. You can edit it before publishing.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => promoteMutation.mutate()}>
                Restore
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );

  const unsavedIndicator = editor.isDirty && !isReadOnly && (
    <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
      <span className="size-2 rounded-full bg-warning-text" />
      Unsaved changes
    </div>
  );

  const versionBadge = (
    <Badge
      variant={
        localEntry.versionState === 'draft'
          ? 'draft'
          : localEntry.versionState === 'published'
            ? 'published'
            : 'historical'
      }
      className="text-xs"
    >
      {localEntry.versionState === 'draft'
        ? 'Draft'
        : localEntry.versionState === 'published'
          ? 'Published'
          : 'Historical'}{' '}
      v{localEntry.version}
    </Badge>
  );

  const versionPanel = (
    <VersionPanel
      entryId={entryId!}
      versions={versions}
      currentVersion={versionNum}
      isLoading={versionsLoading}
      onCompare={() => setDiffOpen(true)}
    />
  );

  const editorContent = (
    <div className="space-y-4">
      <FirstUseHint
        hintId="editor"
        title="Welcome to the Editor"
        description="Your entry has a title, system message, and prompt cards. Use the right sidebar for actions, details, and version history."
        section="entry-editor"
      />
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {versionBadge}
          {unsavedIndicator}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <Input
              value={localEntry.title}
              onChange={(e) => editor.handleChange({ title: e.target.value })}
              disabled={isReadOnly}
              placeholder="Entry title"
              className="text-xl md:text-2xl font-bold h-12 md:h-14 border-transparent bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary/40 rounded-none transition-colors"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 shrink-0"
                aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                onClick={handleToggleFavorite}
                disabled={isFavoritePending}
              >
                <Star
                  className={`size-5 transition-colors ${isFavorited ? 'fill-yellow-500 text-yellow-500' : 'text-foreground-muted hover:text-yellow-500'}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            </TooltipContent>
          </Tooltip>
          <HelpLink section="entry-editor" />
        </div>
      </div>
      {readOnlyBanner}
      {isSoftLocked && activeEditor && (
        <SoftLockBanner activeEditor={activeEditor} onOverride={() => setSoftLockOverride(true)} />
      )}
      {editor.showEditNotice && (
        <div className="rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
          Editing will create a new draft (v{(entryData?.version ?? 0) + 1}). Your published version
          remains active until you publish the draft.
        </div>
      )}
      <PromptEditor
        key={editor.discardVersion}
        entry={localEntry}
        onChange={editor.handleChange}
        isReadOnly={isReadOnly}
        hideTitleInput
      />
    </div>
  );

  const sharedActionProps = {
    entry: localEntry,
    isDirty: editor.isDirty,
    isReadOnly,
    onSave: mutations.handleSave,
    onDiscard: editor.handleDiscard,
    onUndo: editor.handleUndo,
    onRedo: editor.handleRedo,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    onPublish: handlePublishWithCheck,
    onEnhance: () => navigate(`/entry/${entryId}/enhance`),
    isSaving: mutations.saveMutation.isPending,
    isPublishing: mutations.publishMutation.isPending,
    folderName,
    onMoveFolder: () => setFolderPickerOpen(true),
    onGenerateSystemMessage: mutations.handleGenerateSystemMessage,
    onDecomposeToChain: mutations.handleDecomposeToChain,
    isGeneratingSystemMessage: mutations.isGeneratingSystemMessage,
    isDecomposing: mutations.isDecomposing,
    showGenerateSystemMessage: !localEntry.systemMessage,
    showDecomposeToChain: localEntry.prompts.length === 1,
    onTest: aiEnabled && !isReadOnly ? () => navigate(`/entry/${entryId}/test`) : undefined,
    versions,
    onDeleteDraft: () => deleteDraftMutation.mutate(),
    isDeletingDraft: deleteDraftMutation.isPending,
    onShare:
      !isReadOnly && currentUser?.role !== 'viewer'
        ? () => {
            setShareDialogEverOpened(true);
            setShareDialogOpen(true);
          }
        : undefined,
    hasShareLink: !!shareLinkQuery.data && !shareLinkQuery.error,
    hasEmptyTitle: !localEntry.title?.trim(),
    localEvaluation: pendingEvaluation,
    isEvaluating,
    onEvaluate: handleEvaluate,
    presenceUsers,
    onDuplicate: !isReadOnly ? () => startDuplicate(localEntry) : undefined,
    isDuplicating,
  } as const;

  const isAiRunning =
    mutations.isGeneratingSystemMessage || mutations.isDecomposing || isEvaluating;
  const aiLabel = mutations.isGeneratingSystemMessage
    ? 'Generating system message…'
    : mutations.isDecomposing
      ? 'Decomposing prompt…'
      : 'Evaluating prompt…';

  const dialogs = (
    <EditorDialogs
      entryId={entryId!}
      versions={versions}
      versionNum={versionNum}
      folderPickerOpen={folderPickerOpen}
      onFolderPickerOpenChange={setFolderPickerOpen}
      onFolderSelect={(folderId) => {
        mutations.moveMutation.mutate({ folderId });
        setFolderPickerOpen(false);
      }}
      diffOpen={diffOpen}
      onDiffOpenChange={setDiffOpen}
      shareDialogOpen={shareDialogOpen}
      onShareDialogOpenChange={setShareDialogOpen}
      dupFolderPickerOpen={dupFolderPickerState.open}
      onDupFolderPickerOpenChange={(open) => {
        if (!open) cancelDuplicate();
      }}
      onDupFolderSelect={confirmDuplicate}
      conflictState={mutations.conflictState}
      onDismissConflict={mutations.handleDismissConflict}
      onResolveConflict={mutations.handleResolveConflict}
      showEmptyPublishWarning={showEmptyPublishWarning}
      onEmptyPublishWarningChange={setShowEmptyPublishWarning}
      onPublishAnyway={() => {
        setShowEmptyPublishWarning(false);
        mutations.handlePublish();
      }}
      blockerState={blocker.state}
      onBlockerReset={blocker.reset}
      onBlockerProceed={blocker.proceed}
    />
  );

  // ── Mobile layout ──
  if (isMobile) {
    return (
      <div className="p-5">
        <EditorAiOverlay
          isVisible={isAiRunning}
          label={aiLabel}
          onCancel={mutations.handleCancelAiOperation}
        />
        {readOnlyBanner && <div className="mb-4">{readOnlyBanner}</div>}
        {isSoftLocked && activeEditor && (
          <div className="mb-4">
            <SoftLockBanner
              activeEditor={activeEditor}
              onOverride={() => setSoftLockOverride(true)}
            />
          </div>
        )}
        <Tabs defaultValue="editor">
          <TabsList className="w-full">
            <TabsTrigger value="editor" className="flex-1">
              Editor
            </TabsTrigger>
            <TabsTrigger value="panel" className="flex-1">
              Panel
            </TabsTrigger>
          </TabsList>
          <TabsContent value="editor">{editorContent}</TabsContent>
          <TabsContent value="panel">
            <EditorActionPanel {...sharedActionProps} versionPanel={versionPanel} />
          </TabsContent>
        </Tabs>
        {dialogs}
      </div>
    );
  }

  // ── Desktop layout ──
  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_360px] gap-0">
      <EditorAiOverlay
        isVisible={isAiRunning}
        label={aiLabel}
        onCancel={mutations.handleCancelAiOperation}
      />
      <ScrollArea className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {editorContent}
        </motion.div>
      </ScrollArea>

      <div
        className="bg-surface border-l border-border-subtle p-4 h-full overflow-hidden"
        data-tour="editor-actions"
      >
        <EditorActionPanel {...sharedActionProps} versionPanel={versionPanel} />
      </div>

      {dialogs}
    </div>
  );
};

export default EntryEditorPage;
