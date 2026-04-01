import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Redo2, Star, Undo2 } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useBlocker } from 'react-router-dom';
import { toast } from 'sonner';

import { FirstUseHint } from '@/components/common/FirstUseHint';
import { HelpLink } from '@/components/common/HelpLink';
import { CreateTabDialog } from '@/components/editor/CreateTabDialog';
import { EditorActionPanel } from '@/components/editor/EditorActionPanel';
import { EditorAiOverlay } from '@/components/editor/EditorAiOverlay';
import { EditorDialogs } from '@/components/editor/EditorDialogs';
import { EditorError, EditorSkeleton } from '@/components/editor/EditorLoadingStates';
import { PromptEditor } from '@/components/editor/PromptEditor';
import { SoftLockBanner } from '@/components/editor/SoftLockBanner';
import { TabBar } from '@/components/editor/TabBar';
import { VersionPanel } from '@/components/editor/VersionPanel';
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
import { useTabPublish } from '@/hooks/useTabPublish';
import { findFolderName } from '@/lib/folderUtils';
import { entryService, folderService } from '@/services';
import { ApiError } from '@/services/api/apiClient';
import { getShareLink } from '@/services/api/shareLinkService';
import { useAuthStore } from '@/store/authStore';
import type { TabInfo } from '@/types';

const EntryEditorPage = () => {
  const { entryId, version } = useParams<{ entryId: string; version?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentUser = useAuthStore((s) => s.currentUser);

  const versionNum = version ? parseInt(version, 10) : undefined;
  const [softLockOverride, setSoftLockOverride] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string | undefined>(undefined);
  const [viewingPublished, setViewingPublished] = useState(false);
  const [createTabOpen, setCreateTabOpen] = useState(false);
  const shouldDefaultToPublished = useRef(true);

  // ── Data fetching ──

  // Fetch tab list first to resolve Main tab
  const { data: tabs = [] } = useQuery({
    queryKey: ['tabs', entryId],
    queryFn: () => entryService.listTabs(entryId!),
    enabled: !!entryId,
  });

  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['versions', entryId],
    queryFn: () => entryService.getVersionHistory(entryId!),
    enabled: !!entryId,
  });

  // Set active tab to Main tab on initial load (or first available tab)
  // If entry has a published version, default to published view on initial load
  const mainTab = useMemo(() => tabs.find((t: TabInfo) => t.isMainTab), [tabs]);
  const hasPublishedVersion = useMemo(
    () => versions.some((v) => v.versionState === 'published'),
    [versions],
  );
  useEffect(() => {
    if (!activeTabId && tabs.length > 0) {
      setActiveTabId(mainTab?.id ?? tabs[0].id);
    }
  }, [activeTabId, mainTab, tabs]);
  useEffect(() => {
    if (searchParams.get('tab') === 'main') {
      setViewingPublished(false);
      shouldDefaultToPublished.current = false;
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
      return;
    }
    if (shouldDefaultToPublished.current && hasPublishedVersion) {
      setViewingPublished(true);
      shouldDefaultToPublished.current = false;
    }
  }, [hasPublishedVersion, searchParams, setSearchParams]);

  // Fetch active tab content (or main entry for version view / published view)
  const {
    data: entryData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: viewingPublished
      ? ['entry', entryId, 'published']
      : activeTabId
        ? ['entry', entryId, 'tab', activeTabId]
        : ['entry', entryId],
    queryFn: () => {
      if (viewingPublished) {
        // Fetch published version — find version number from versions list
        const pubVersion = versions.find((v) => v.versionState === 'published');
        if (pubVersion) return entryService.getVersion(entryId!, pubVersion.version);
        return entryService.getEntry(entryId!);
      }
      if (activeTabId) return entryService.getTab(entryId!, activeTabId);
      return entryService.getEntry(entryId!);
    },
    enabled: !!entryId && (!viewingPublished || versions.length > 0),
    placeholderData: keepPreviousData,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
  });

  const queryClient = useQueryClient();

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
    activeTabId,
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

  const trashMutation = useMutation({
    mutationFn: () => entryService.trashEntry(entryId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      toast.success('Entry moved to trash');
      navigate('/library');
    },
    onError: () => toast.error('Failed to move entry to trash'),
  });

  const isSoftLocked = !!activeEditor && !softLockOverride;
  const isReadOnly = !!version || viewingPublished || currentUser?.role === 'viewer' || isSoftLocked;
  const isMetadataReadOnly = !!version || currentUser?.role === 'viewer';

  // Reset soft lock override when navigating to a different entry
  useEffect(() => {
    setSoftLockOverride(false);
  }, [entryId]);

  // Toast when another user starts editing while we're editing
  onEditorJoinedRef.current = (user) => {
    toast.info(`${user.name} started editing this prompt`);
  };

  const {
    showEmptyPublishWarning,
    setShowEmptyPublishWarning,
    handlePublishWithCheck,
  } = useTabPublish({
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
  } = useFavoriteMutation(entryId, entryData?.isFavorited ?? false, activeTabId);

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
  const hasPublished = versions.some((v) => v.versionState === 'published');
  const publishedVersion = versions.find((v) => v.versionState === 'published');

  const readOnlyBanner = isReadOnly && version && (
    <div className="flex items-center gap-3 rounded-md border border-warning-border bg-warning-bg px-4 py-2.5 text-sm">
      <AlertTriangle className="size-4 text-warning-text shrink-0" />
      <span className="flex-1 text-warning-text">Viewing v{version} (read-only)</span>
      {canRestore && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            entryService.restoreVersion(entryId!, parseInt(version, 10)).then(() => {
              navigate(`/entry/${entryId}`);
              toast.success(`Restored v${version} to new tab`);
            });
          }}
        >
          Restore to tab
        </Button>
      )}
    </div>
  );

  const unsavedIndicator = editor.isDirty && !isReadOnly && (
    <div className="flex items-center gap-1.5 text-xs text-foreground-muted">
      <span className="size-2 rounded-full bg-warning-text" />
      Unsaved changes
    </div>
  );

  const versionBadge = (() => {
    if (version) {
      // Viewing a historical version — show version number
      const state = versions.find((v) => v.version === versionNum)?.versionState;
      return (
        <Badge variant={state === 'published' ? 'published' : 'historical'} className="text-xs">
          v{versionNum} — {state === 'published' ? 'Published' : 'Historical'}
        </Badge>
      );
    }
    if (viewingPublished) {
      return (
        <Badge variant="published" className="text-xs">
          Published
        </Badge>
      );
    }
    // On a working tab: only show badge if entry has never been published
    // (the Published tab in the tab bar already signals published status)
    if (!hasPublished) {
      return (
        <Badge variant="historical" className="text-xs">
          Unpublished
        </Badge>
      );
    }
    return null;
  })();

  const versionPanel = (
    <VersionPanel
      entryId={entryId!}
      versions={versions}
      currentVersion={versionNum}
      isLoading={versionsLoading}
      onCompare={() => setDiffOpen(true)}
    />
  );

  const handleDeleteTab = (tabId: string) => {
    entryService.deleteTab(entryId!, tabId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['tabs', entryId] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      toast.success('Tab deleted');
      if (activeTabId === tabId && mainTab) {
        setActiveTabId(mainTab.id);
      }
    });
  };

  const editorContent = (
    <div className="space-y-4">
      <FirstUseHint
        hintId="editor"
        title="Welcome to the Editor"
        description="Your entry has a title, system message, and prompt cards. Use the right sidebar for actions, details, and version history."
        section="entry-editor"
      />

      {/* Tab bar */}
      {!version && (tabs.length > 0 || hasPublished) && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={(tabId) => {
            setViewingPublished(false);
            setActiveTabId(tabId);
          }}
          onCreateTab={() => setCreateTabOpen(true)}
          onDeleteTab={handleDeleteTab}
          onViewPublished={hasPublished ? () => setViewingPublished(true) : undefined}
          hasPublished={hasPublished}
          isViewingPublished={viewingPublished}
          isReadOnly={isReadOnly}
          isDirty={editor.isDirty}
        />
      )}

      <div className="space-y-1">
        {(versionBadge || unsavedIndicator) && (
          <div className="flex items-center gap-2">
            {versionBadge}
            {unsavedIndicator}
          </div>
        )}
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
          {!isReadOnly && (
            <div className="inline-flex items-center gap-0.5 rounded-md border border-border-subtle p-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={editor.handleUndo}
                    disabled={!editor.canUndo}
                    className="size-8"
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
                    onClick={editor.handleRedo}
                    disabled={!editor.canRedo}
                    className="size-8"
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
          )}
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
      <PromptEditor
        key={editor.discardVersion}
        entry={localEntry}
        onChange={editor.handleChange}
        isReadOnly={isReadOnly}
        hideTitleInput
        contentKey={viewingPublished ? 'published' : activeTabId}
      />
    </div>
  );

  const sharedActionProps = {
    entry: localEntry,
    isDirty: editor.isDirty,
    isReadOnly,
    isMetadataReadOnly,
    onSave: mutations.handleSave,
    onDiscard: editor.handleDiscard,
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
    onTest: aiEnabled ? () => navigate(`/entry/${entryId}/test`) : undefined,
    versions,
    onShare:
      currentUser?.role !== 'viewer'
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
    onDuplicate: () => startDuplicate(localEntry),
    isDuplicating,
    onMoveToTrash: currentUser?.role !== 'viewer' ? () => trashMutation.mutate() : undefined,
    isMovingToTrash: trashMutation.isPending,
  } as const;

  const isAiRunning =
    mutations.isGeneratingSystemMessage || mutations.isDecomposing || isEvaluating;
  const aiLabel = mutations.isGeneratingSystemMessage
    ? 'Generating system message…'
    : mutations.isDecomposing
      ? 'Decomposing prompt…'
      : 'Evaluating prompt…';

  const dialogs = (
    <>
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
      <CreateTabDialog
        entryId={entryId!}
        versions={versions}
        open={createTabOpen}
        onOpenChange={setCreateTabOpen}
        onCreated={(tabId) => {
          setViewingPublished(false);
          setActiveTabId(tabId);
        }}
      />
    </>
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
          <TabsContent value="panel" data-tour="editor-actions">
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
        {editorContent}
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
