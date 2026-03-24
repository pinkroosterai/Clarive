import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { GitCompareArrows, FlaskConical, Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { HelpPopover } from '@/components/common/HelpPopover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handleApiError';
import { createVariant, deleteVariant, renameVariant } from '@/services/api/entryService';
import type { VersionInfo } from '@/types';

const versionBadgeVariant: Record<string, 'draft' | 'published' | 'historical'> = {
  draft: 'draft',
  published: 'published',
  historical: 'historical',
  variant: 'draft',
};

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

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newVariantName, setNewVariantName] = useState('');
  const [baseVersion, setBaseVersion] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const { variants, history, publishableVersions } = useMemo(() => {
    const vrnts = versions.filter((v) => v.versionState === 'variant');
    const hist = versions.filter((v) => v.versionState !== 'variant');
    const publishable = hist.filter(
      (v) => v.versionState === 'published' || v.versionState === 'historical'
    );
    return { variants: vrnts, history: hist, publishableVersions: publishable };
  }, [versions]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['versions', entryId] });

  const createMutation = useMutation({
    mutationFn: () => createVariant(entryId, newVariantName, parseInt(baseVersion, 10)),
    onSuccess: () => {
      invalidate();
      setShowCreateForm(false);
      setNewVariantName('');
      setBaseVersion('');
    },
    onError: (err) => handleApiError(err, { title: 'Failed to create variant' }),
  });

  const renameMutation = useMutation({
    mutationFn: (args: { variantId: string; newName: string }) =>
      renameVariant(entryId, args.variantId, args.newName),
    onSuccess: () => {
      invalidate();
      setRenamingId(null);
    },
    onError: (err) => handleApiError(err, { title: 'Failed to rename variant' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => deleteVariant(entryId, variantId),
    onSuccess: invalidate,
    onError: (err) => handleApiError(err, { title: 'Failed to delete variant' }),
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
      {/* ── Variants Section ── */}
      {(variants.length > 0 || showCreateForm) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
              Variants
            </h3>
            {!showCreateForm && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="size-3" />
              </Button>
            )}
          </div>

          {/* Create form */}
          {showCreateForm && (
            <div className="space-y-2 rounded-md border border-border-subtle p-2">
              <Input
                placeholder="Variant name"
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
              <Select value={baseVersion} onValueChange={setBaseVersion}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Base version" />
                </SelectTrigger>
                <SelectContent>
                  {publishableVersions.map((v) => (
                    <SelectItem key={v.version} value={String(v.version)} className="text-xs">
                      v{v.version} ({v.versionState})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-6 text-xs flex-1"
                  disabled={!newVariantName || !baseVersion || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  Create
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setShowCreateForm(false)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Variant list */}
          {variants.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-elevated transition-colors"
            >
              {renamingId === v.id ? (
                <div className="flex items-center gap-1 flex-1 mr-1">
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-6 text-xs flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameValue)
                        renameMutation.mutate({ variantId: v.id, newName: renameValue });
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => renameMutation.mutate({ variantId: v.id, newName: renameValue })}
                  >
                    <Check className="size-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="size-3 text-foreground-muted shrink-0" />
                    <span className="font-medium truncate">{v.variantName}</span>
                    <Badge variant="historical" className="text-[10px] px-1 py-0">
                      v{v.basedOnVersion}
                    </Badge>
                  </div>
                </div>
              )}
              {renamingId !== v.id && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setRenamingId(v.id);
                      setRenameValue(v.variantName ?? '');
                    }}
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => deleteMutation.mutate(v.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create variant button (when none exist) ── */}
      {variants.length === 0 && !showCreateForm && publishableVersions.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs"
          onClick={() => setShowCreateForm(true)}
        >
          <FlaskConical className="size-3" />
          Create Variant
        </Button>
      )}

      {/* ── Version History Section ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Version History
          </h3>
          <HelpPopover
            content="Every publish creates a new version. Compare any two versions side-by-side or restore a historical version as a new draft."
            section="entry-editor"
          />
        </div>

        <div className="relative ml-3 border-l-2 border-border-subtle pl-5 space-y-1">
          {history.map((v) => {
            const isActive =
              currentVersion !== undefined
                ? v.version === currentVersion
                : v.version === history[0]?.version;

            const workingVersion =
              history.find((ver) => ver.versionState === 'draft') ??
              history.find((ver) => ver.versionState === 'published');
            const isEditing = !currentVersion && workingVersion?.version === v.version;

            return (
              <motion.button
                key={v.version}
                whileHover={{ x: 2, backgroundColor: 'hsl(var(--background-elevated))' }}
                transition={{ duration: 0.15 }}
                className={`relative w-full text-left rounded-md px-3 py-2 text-sm transition-colors duration-150 ${
                  isActive ? 'bg-primary/8' : ''
                }`}
                onClick={() => {
                  if (workingVersion && v.version === workingVersion.version) {
                    navigate(`/entry/${entryId}`);
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
                  <span className="font-medium">
                    v{v.version}
                    {isEditing && (
                      <span className="ml-1.5 italic font-normal text-foreground-muted">
                        (editing)
                      </span>
                    )}
                  </span>
                  <Badge variant={versionBadgeVariant[v.versionState] ?? 'historical'}>
                    {v.versionState.charAt(0).toUpperCase() + v.versionState.slice(1)}
                  </Badge>
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

        {history.length === 1 && (
          <p className="text-xs text-foreground-muted text-center py-2">
            Version history will grow as you publish.
          </p>
        )}

        {history.length >= 2 && onCompare && (
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={onCompare}>
            <GitCompareArrows className="size-3.5" />
            Compare versions
          </Button>
        )}
      </div>
    </div>
  );
}
