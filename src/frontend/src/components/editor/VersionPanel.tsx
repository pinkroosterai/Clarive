import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronDown, GitCompareArrows, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { HelpPopover } from '@/components/common/HelpPopover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handleApiError';
import { getVersion, restoreVersion } from '@/services/api/entryService';
import type { VersionInfo } from '@/types';

interface VersionPanelProps {
  entryId: string;
  versions: VersionInfo[];
  currentVersion?: number;
  isLoading?: boolean;
  onCompare?: () => void;
}

export function VersionPanel({
  entryId,
  versions,
  currentVersion,
  isLoading,
  onCompare,
}: VersionPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreTargetVersion, setRestoreTargetVersion] = useState<number | null>(null);
  const [newTabName, setNewTabName] = useState('');

  // Only show published + historical in the timeline (tabs are shown in the TabBar)
  const history = useMemo(
    () =>
      versions
        .filter((v) => v.versionState === 'published' || v.versionState === 'historical')
        .sort((a, b) => b.version - a.version),
    [versions]
  );

  const restoreMutation = useMutation({
    mutationFn: () => restoreVersion(entryId, restoreTargetVersion!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs', entryId] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
      toast.success(`Restored v${restoreTargetVersion} to new tab`);
      setRestoreDialogOpen(false);
      setNewTabName('');
      navigate(`/entry/${entryId}`);
    },
    onError: (err) => handleApiError(err, { title: 'Failed to restore version' }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          Version History
        </h3>
        <div className="relative ml-3 border-l-2 border-border-subtle pl-5 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[25px] top-1 size-3 rounded-full bg-elevated" />
              <Skeleton className="h-4 w-16 mb-1.5" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour="version-panel">
      {/* ── Version History Section ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Version History
          </h3>
          <HelpPopover
            content="Every publish creates a new version snapshot. Click to view, or restore any version to a new tab."
            section="entry-editor"
          />
        </div>

        {history.length === 0 && (
          <p className="text-xs text-foreground-muted text-center py-4">
            No versions published yet. Publish a tab to create v1.
          </p>
        )}

        <div className="relative ml-3 border-l-2 border-border-subtle pl-5 space-y-1">
          {history.map((v) => {
            const isActive =
              currentVersion !== undefined
                ? v.version === currentVersion
                : v.versionState === 'published';

            return (
              <motion.button
                key={v.version}
                whileHover={{ x: 2, backgroundColor: 'hsl(var(--background-elevated))' }}
                transition={{ duration: 0.15 }}
                className={`group relative w-full text-left rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                  isActive ? 'bg-primary/8' : ''
                }`}
                onClick={() => {
                  if (v.versionState === 'published' && !currentVersion) {
                    // Already viewing the main tab
                  } else {
                    navigate(`/entry/${entryId}/version/${v.version}`);
                  }
                }}
              >
                {/* Timeline dot */}
                <motion.div
                  className={`absolute -left-[25px] top-3 rounded-full ring-2 ring-background ${
                    isActive ? 'size-3 bg-primary' : 'size-2.5 bg-foreground-muted/40'
                  }`}
                  animate={
                    isActive
                      ? { scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] }
                      : { scale: 1, opacity: 1 }
                  }
                  transition={
                    isActive
                      ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.2 }
                  }
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">v{v.version}</span>
                  <div className="flex items-center gap-1">
                    {v.versionState === 'historical' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRestoreTargetVersion(v.version);
                          setNewTabName(`Restored v${v.version}`);
                          setRestoreDialogOpen(true);
                        }}
                      >
                        <RotateCcw className="size-3 mr-0.5" />
                        Restore
                      </Button>
                    )}
                    <Badge variant={v.versionState === 'published' ? 'published' : 'historical'}>
                      {v.versionState === 'published' ? 'Published' : 'Historical'}
                    </Badge>
                  </div>
                </div>
                {v.publishedAt && (
                  <p className="text-xs text-foreground-muted mt-0.5">
                    {format(new Date(v.publishedAt), 'MMM d, yyyy')}
                    {v.publishedBy && ` by ${v.publishedBy}`}
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>

        {history.length >= 2 && onCompare && (
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={onCompare}>
            <GitCompareArrows className="size-3.5" />
            Compare versions
          </Button>
        )}
      </div>

      {/* ── Restore Dialog ── */}
      <RestoreDialog
        entryId={entryId}
        version={restoreTargetVersion}
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        tabName={newTabName}
        onTabNameChange={setNewTabName}
        onRestore={() => restoreMutation.mutate()}
        isPending={restoreMutation.isPending}
      />
    </div>
  );
}

/* ── Restore Dialog with Preview ── */

function RestoreDialog({
  entryId,
  version,
  open,
  onOpenChange,
  tabName,
  onTabNameChange,
  onRestore,
  isPending,
}: {
  entryId: string;
  version: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabName: string;
  onTabNameChange: (name: string) => void;
  onRestore: () => void;
  isPending: boolean;
}) {
  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['version-preview', entryId, version],
    queryFn: () => getVersion(entryId, version!),
    enabled: open && version !== null,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Restore v{version}</DialogTitle>
          <DialogDescription>
            This will create a new tab with the content from v{version}.
          </DialogDescription>
        </DialogHeader>

        {/* Preview section */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors [&[data-state=open]>svg]:rotate-180">
            <ChevronDown className="size-3.5 transition-transform duration-200" />
            Preview
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <ScrollArea className="max-h-[200px] rounded-md border border-border bg-elevated p-3">
              {previewLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ) : preview ? (
                <div className="space-y-2 text-xs text-foreground-muted">
                  {preview.systemMessage && (
                    <div>
                      <span className="font-semibold text-foreground">System:</span>{' '}
                      <span className="whitespace-pre-wrap">{preview.systemMessage}</span>
                    </div>
                  )}
                  {preview.prompts?.map((p, i) => (
                    <div key={p.id || i}>
                      <span className="font-semibold text-foreground">
                        Prompt {preview.prompts.length > 1 ? `#${i + 1}` : ''}:
                      </span>{' '}
                      <span className="whitespace-pre-wrap">
                        {p.content || '(empty)'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-foreground-muted">Unable to load preview.</p>
              )}
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>

        <div className="space-y-2 py-1">
          <Label htmlFor="restore-tab-name">New tab name</Label>
          <Input
            id="restore-tab-name"
            value={tabName}
            onChange={(e) => onTabNameChange(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onRestore} disabled={isPending}>
            {isPending ? 'Restoring...' : 'Restore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
