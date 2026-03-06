import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useRef } from 'react';

import { DiffBlock } from './DiffBlock';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { entryService } from '@/services';
import type { VersionInfo } from '@/types';

interface VersionDiffDialogProps {
  entryId: string;
  versions: VersionInfo[];
  currentVersion?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionDiffDialog({
  entryId,
  versions,
  currentVersion,
  open,
  onOpenChange,
}: VersionDiffDialogProps) {
  // Default selection: right = current working version, left = most recent other
  const workingVersion =
    versions.find((v) => v.versionState === 'draft') ??
    versions.find((v) => v.versionState === 'published');

  const defaultRight = currentVersion ?? workingVersion?.version ?? versions[0]?.version;
  const defaultLeft = versions.find((v) => v.version !== defaultRight)?.version ?? defaultRight;

  const [leftVersion, setLeftVersion] = useState<number>(defaultLeft ?? 1);
  const [rightVersion, setRightVersion] = useState<number>(defaultRight ?? 1);

  // Reset defaults when dialog opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const right = currentVersion ?? workingVersion?.version ?? versions[0]?.version ?? 1;
      const left = versions.find((v) => v.version !== right)?.version ?? right;
      setLeftVersion(left);
      setRightVersion(right);
    }
    prevOpenRef.current = open;
  }, [open, currentVersion, versions, workingVersion]);

  const leftQuery = useQuery({
    queryKey: ['version', entryId, leftVersion],
    queryFn: () => entryService.getVersion(entryId, leftVersion),
    enabled: open && leftVersion !== undefined,
  });

  const rightQuery = useQuery({
    queryKey: ['version', entryId, rightVersion],
    queryFn: () => entryService.getVersion(entryId, rightVersion),
    enabled: open && rightVersion !== undefined,
  });

  const isLoading = leftQuery.isLoading || rightQuery.isLoading;
  const left = leftQuery.data;
  const right = rightQuery.data;

  // Build prompt diffs — match by order, handle added/removed
  const promptDiffs = useMemo(() => {
    if (!left || !right) return [];
    const leftPrompts = [...left.prompts].sort((a, b) => a.order - b.order);
    const rightPrompts = [...right.prompts].sort((a, b) => a.order - b.order);
    const maxLen = Math.max(leftPrompts.length, rightPrompts.length);

    const diffs: {
      label: string;
      oldText: string;
      newText: string;
      badge?: 'added' | 'removed';
    }[] = [];
    for (let i = 0; i < maxLen; i++) {
      const lp = leftPrompts[i];
      const rp = rightPrompts[i];

      if (lp && rp) {
        diffs.push({
          label: `Prompt #${i + 1}`,
          oldText: lp.content,
          newText: rp.content,
        });
      } else if (!lp && rp) {
        diffs.push({
          label: `Prompt #${i + 1}`,
          oldText: '',
          newText: rp.content,
          badge: 'added',
        });
      } else if (lp && !rp) {
        diffs.push({
          label: `Prompt #${i + 1}`,
          oldText: lp.content,
          newText: '',
          badge: 'removed',
        });
      }
    }
    return diffs;
  }, [left, right]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Versions</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 pt-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-foreground-muted">Left (old)</label>
            <Select value={String(leftVersion)} onValueChange={(v) => setLeftVersion(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>
                    v{v.version} ({v.versionState})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-foreground-muted pt-5">vs</span>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-foreground-muted">Right (new)</label>
            <Select value={String(rightVersion)} onValueChange={(v) => setRightVersion(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>
                    v{v.version} ({v.versionState})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8">
            <LoadingSpinner />
          </div>
        ) : left && right ? (
          <div className="space-y-3 pt-2">
            {/* Title diff */}
            <DiffBlock label="Title" oldText={left.title} newText={right.title} />

            {/* System message diff */}
            {(left.systemMessage !== null || right.systemMessage !== null) && (
              <div className="space-y-1.5">
                {left.systemMessage === null && right.systemMessage !== null && (
                  <Badge variant="draft" className="text-xs">
                    System message added
                  </Badge>
                )}
                {left.systemMessage !== null && right.systemMessage === null && (
                  <Badge variant="historical" className="text-xs">
                    System message removed
                  </Badge>
                )}
                <DiffBlock
                  label="System Message"
                  oldText={left.systemMessage ?? ''}
                  newText={right.systemMessage ?? ''}
                />
              </div>
            )}

            {/* Prompt diffs */}
            {promptDiffs.map((diff, i) => (
              <div key={i} className="space-y-1.5">
                {diff.badge === 'added' && (
                  <Badge variant="draft" className="text-xs">
                    Prompt added
                  </Badge>
                )}
                {diff.badge === 'removed' && (
                  <Badge variant="historical" className="text-xs">
                    Prompt removed
                  </Badge>
                )}
                <DiffBlock label={diff.label} oldText={diff.oldText} newText={diff.newText} />
              </div>
            ))}

            {/* No differences message */}
            {!promptDiffs.some((d) => d.oldText !== d.newText) &&
              left.title === right.title &&
              left.systemMessage === right.systemMessage && (
                <p className="text-sm text-foreground-muted text-center py-6">
                  No differences found between these versions.
                </p>
              )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
