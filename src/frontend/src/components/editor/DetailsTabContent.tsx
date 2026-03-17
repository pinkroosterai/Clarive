import { format } from 'date-fns';
import { FolderInput, Clock, User, Calendar, Copy, History } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ActivityTimeline } from '@/components/editor/ActivityTimeline';
import { TagEditor } from '@/components/editor/TagEditor';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { copyToClipboard } from '@/lib/utils';
import type { PromptEntry } from '@/types';

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

export interface DetailsTabContentProps {
  entry: PromptEntry;
  folderName: string;
  onMoveFolder: () => void;
  isReadOnly: boolean;
}

export function DetailsTabContent({
  entry,
  folderName,
  onMoveFolder,
  isReadOnly,
}: DetailsTabContentProps) {
  const [showActivity, setShowActivity] = useState(false);

  return (
    <div className="space-y-4">
      <ActionGroup label="Tags">
        <TagEditor entryId={entry.id} readOnly={isReadOnly} />
      </ActionGroup>

      <Separator />

      <ActionGroup label="Metadata">
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center gap-2 text-foreground-muted">
            <Calendar className="size-3.5" />
            <span>Created {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
          <div className="flex items-center gap-2 text-foreground-muted">
            <Clock className="size-3.5" />
            <span>Modified {format(new Date(entry.updatedAt), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
          <div className="flex items-center gap-2 text-foreground-muted">
            <User className="size-3.5" />
            <span>{entry.createdBy}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-foreground-muted h-auto p-0 hover:text-foreground"
            onClick={async () => {
              try {
                await copyToClipboard(entry.id);
                toast.success('Entry ID copied to clipboard');
              } catch {
                toast.error('Failed to copy entry ID');
              }
            }}
          >
            <Copy className="size-3.5" />
            <span className="text-sm">Copy Entry ID</span>
          </Button>
        </div>
      </ActionGroup>

      <Separator />

      <ActionGroup label="Folder">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground-muted">{folderName}</span>
          {!isReadOnly && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={onMoveFolder}>
              <FolderInput className="size-3.5" /> Move
            </Button>
          )}
        </div>
      </ActionGroup>

      <Separator />

      <ActionGroup label="Activity">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 w-full justify-start"
          onClick={() => setShowActivity(!showActivity)}
        >
          <History className="size-3.5" />
          {showActivity ? 'Hide activity' : 'Show activity'}
        </Button>
        {showActivity && <ActivityTimeline entryId={entry.id} />}
      </ActionGroup>
    </div>
  );
}
