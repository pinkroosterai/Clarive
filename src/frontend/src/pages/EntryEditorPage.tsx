import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, Star } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

import { EditorActionPanel } from '@/components/editor/EditorActionPanel';
import { EditorAiOverlay } from '@/components/editor/EditorAiOverlay';
import { PromptEditor } from '@/components/editor/PromptEditor';
import { ShareDialog } from '@/components/editor/ShareDialog';
import { VersionDiffDialog } from '@/components/editor/VersionDiffDialog';
import { VersionPanel } from '@/components/editor/VersionPanel';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { useEditorKeyboardShortcuts } from '@/hooks/useEditorKeyboardShortcuts';
import { useEditorMutations } from '@/hooks/useEditorMutations';
import { useEditorState } from '@/hooks/useEditorState';
import { findFolderName } from '@/lib/folderUtils';
import { entryService, folderService } from '@/services';
import * as favoriteService from '@/services/api/favoriteService';
import { useAuthStore } from '@/store/authStore';

const EntryEditorPage = () => {
  const { entryId, version } = useParams<{ entryId: string; version?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const currentUser = useAuthStore((s) => s.currentUser);

  const isReadOnly = !!version || currentUser?.role === 'viewer';
  const versionNum = version ? parseInt(version, 10) : undefined;

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

  const mutations = useEditorMutations({
    entryId,
    localEntryRef: editor.localEntryRef,
    onSaveSuccess: () => {
      editor.setIsDirty(false);
      editor.clearHistory();
    },
    onPublishSuccess: () => {
      editor.setIsDirty(false);
      editor.clearHistory();
    },
    handleChange: editor.handleChange,
  });

  const hasDraft = versions.some((v) => v.versionState === 'draft');
  const draftVersion = versions.find((v) => v.versionState === 'draft')?.version;

  // ── Shared query client ──
  const queryClient = useQueryClient();

  const promoteMutation = useMutation({
    mutationFn: () => entryService.promoteVersion(entryId!, versionNum!),
    onSuccess: (promoted) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      toast.success('Version restored as new draft');
      navigate(`/entry/${promoted.id}`);
    },
    onError: () => toast.error('Failed to restore version'),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: () => entryService.deleteDraft(entryId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      toast.success('Draft deleted, reverted to published version');
      navigate(`/entry/${entryId}`);
    },
    onError: () => toast.error('Failed to delete draft'),
  });

  useEditorKeyboardShortcuts({
    isReadOnly,
    onSave: mutations.handleSave,
    onPublish: () => {
      if (hasDraft) mutations.handlePublish();
    },
    onUndo: editor.handleUndo,
    onRedo: editor.handleRedo,
  });

  // Warn before closing/refreshing during AI operations
  const isAiRunningEarly = mutations.isGeneratingSystemMessage || mutations.isDecomposing;
  useEffect(() => {
    if (!isAiRunningEarly) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isAiRunningEarly]);

  // ── Favorite toggle ──
  const isFavorited = entryData?.isFavorited ?? false;

  const favoriteMutation = useMutation({
    mutationFn: (currentlyFavorited: boolean) =>
      currentlyFavorited
        ? favoriteService.unfavoriteEntry(entryId!)
        : favoriteService.favoriteEntry(entryId!),
    onMutate: async (currentlyFavorited) => {
      await queryClient.cancelQueries({ queryKey: ['entry', entryId] });
      const previous = queryClient.getQueryData(['entry', entryId]);
      queryClient.setQueryData(['entry', entryId], (old: typeof entryData) =>
        old ? { ...old, isFavorited: !currentlyFavorited } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['entry', entryId], context.previous);
      }
      toast.error('Failed to update favorite');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });

  const handleToggleFavorite = useCallback(() => {
    favoriteMutation.mutate(isFavorited);
  }, [favoriteMutation, isFavorited]);

  // ── Dialog states ──
  const [diffOpen, setDiffOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const aiEnabled = useAiEnabled();

  const folderName = editor.localEntry
    ? findFolderName(folders, editor.localEntry.folderId)
    : 'Root';

  // ── Loading / error ──
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle className="size-10 text-destructive" />
        <h2 className="text-lg font-semibold">Failed to load entry</h2>
        <p className="text-sm text-foreground-muted">
          The entry may have been deleted or you may not have access.
        </p>
        <Button asChild variant="outline">
          <Link to="/library">Back to Library</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || !editor.localEntry) {
    if (isMobile) {
      return (
        <div className="p-4 space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-6 w-32 rounded" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      );
    }
    return (
      <div className="grid h-full grid-cols-[minmax(0,1fr)_300px] gap-0">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-20 rounded" />
            </div>
            <Skeleton className="size-8 rounded" />
          </div>
          <Skeleton className="h-[500px] w-full rounded-xl" />
        </div>
        <div className="bg-surface border-l border-border-subtle p-4 space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-6 w-24 rounded" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-6 w-20 rounded" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {versionBadge}
          {unsavedIndicator}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              onClick={handleToggleFavorite}
              disabled={favoriteMutation.isPending}
            >
              <Star
                className={`size-4.5 transition-colors ${isFavorited ? 'fill-yellow-500 text-yellow-500' : 'text-foreground-muted hover:text-yellow-500'}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          </TooltipContent>
        </Tooltip>
      </div>
      {readOnlyBanner}
      {editor.showEditNotice && (
        <div className="rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
          Editing will create a new draft (v{(entryData?.version ?? 0) + 1}). Your published version
          remains active until you publish the draft.
        </div>
      )}
      <PromptEditor entry={localEntry} onChange={editor.handleChange} isReadOnly={isReadOnly} />
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
    onPublish: mutations.handlePublish,
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
    onShare: !isReadOnly && currentUser?.role !== 'viewer' ? () => setShareDialogOpen(true) : undefined,
  } as const;

  const isAiRunning = mutations.isGeneratingSystemMessage || mutations.isDecomposing;
  const aiLabel = mutations.isGeneratingSystemMessage
    ? 'Generating system message…'
    : 'Decomposing prompt…';

  const dialogs = (
    <>
      <FolderPickerDialog
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        onSelect={(folderId) => {
          mutations.moveMutation.mutate({ folderId });
          setFolderPickerOpen(false);
        }}
      />
      <VersionDiffDialog
        entryId={entryId!}
        versions={versions}
        currentVersion={versionNum}
        open={diffOpen}
        onOpenChange={setDiffOpen}
      />
      <ShareDialog
        entryId={entryId!}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
    </>
  );

  // ── Mobile layout ──
  if (isMobile) {
    return (
      <div className="p-4">
        <EditorAiOverlay
          isVisible={isAiRunning}
          label={aiLabel}
          onCancel={() => window.location.reload()}
        />
        {readOnlyBanner && <div className="mb-4">{readOnlyBanner}</div>}
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
    <div className="grid h-full grid-cols-[minmax(0,1fr)_300px] gap-0">
      <EditorAiOverlay
        isVisible={isAiRunning}
        label={aiLabel}
        onCancel={() => window.location.reload()}
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
        className="bg-surface border-l border-border-subtle p-4 overflow-hidden"
        data-tour="editor-actions"
      >
        <EditorActionPanel {...sharedActionProps} versionPanel={versionPanel} />
      </div>

      {dialogs}
    </div>
  );
};

export default EntryEditorPage;
