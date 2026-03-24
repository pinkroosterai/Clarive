import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { handleApiError } from '@/lib/handleApiError';
import { createTab } from '@/services/api/entryService';
import type { VersionInfo } from '@/types';

interface CreateTabDialogProps {
  entryId: string;
  versions: VersionInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (tabId: string) => void;
}

export function CreateTabDialog({
  entryId,
  versions,
  open,
  onOpenChange,
  onCreated,
}: CreateTabDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [baseVersion, setBaseVersion] = useState('');

  const forkableVersions = versions.filter(
    (v) => v.versionState === 'published' || v.versionState === 'historical'
  );

  const createMutation = useMutation({
    mutationFn: () => createTab(entryId, name, parseInt(baseVersion, 10)),
    onSuccess: (tab) => {
      queryClient.invalidateQueries({ queryKey: ['tabs', entryId] });
      queryClient.invalidateQueries({ queryKey: ['versions', entryId] });
      setName('');
      setBaseVersion('');
      onOpenChange(false);
      onCreated?.(tab.id);
    },
    onError: (err) => handleApiError(err, { title: 'Failed to create tab' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Tab</DialogTitle>
          <DialogDescription>
            Fork content from an existing version to experiment with a different approach.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tab-name">Tab name</Label>
            <Input
              id="tab-name"
              placeholder="e.g. Formal tone"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Fork from version</Label>
            <Select value={baseVersion} onValueChange={setBaseVersion}>
              <SelectTrigger>
                <SelectValue placeholder="Select a version" />
              </SelectTrigger>
              <SelectContent>
                {forkableVersions.map((v) => (
                  <SelectItem key={v.version} value={String(v.version)}>
                    v{v.version}{' '}
                    {v.versionState === 'published' ? '(published)' : ''}
                    {v.publishedAt
                      ? ` — ${new Date(v.publishedAt).toLocaleDateString()}`
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || !baseVersion || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Tab'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
