import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FolderOpen, Undo2, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { buildFolderMap } from '@/lib/folderUtils';
import { parseTemplateTags } from '@/lib/templateParser';
import { entryService, folderService } from '@/services';

const versionBadgeVariant: Record<string, 'draft' | 'published' | 'historical'> = {
  draft: 'draft',
  published: 'published',
  historical: 'historical',
};

interface TrashPreviewSheetProps {
  entryId: string | null;
  onOpenChange: (open: boolean) => void;
  onRestore: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
  isAdmin: boolean;
  isBusy: boolean;
}

export function TrashPreviewSheet({
  entryId,
  onOpenChange,
  onRestore,
  onDelete,
  isAdmin,
  isBusy,
}: TrashPreviewSheetProps) {
  const { data: entry, isLoading } = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => entryService.getEntry(entryId!),
    enabled: !!entryId,
  });

  const { data: folders } = useQuery({
    queryKey: ['folders'],
    queryFn: folderService.getFoldersTree,
  });

  const folderMap = useMemo(() => (folders ? buildFolderMap(folders) : {}), [folders]);

  const templateFields = useMemo(() => {
    if (!entry) return [];
    const allContent = [entry.systemMessage ?? '', ...entry.prompts.map((p) => p.content)].join(
      '\n'
    );
    return parseTemplateTags(allContent);
  }, [entry]);

  const isTemplate = templateFields.length > 0;

  const handleRestore = () => {
    if (entry) {
      onRestore(entry.id, entry.title);
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (entry) {
      onDelete(entry.id, entry.title);
      onOpenChange(false);
    }
  };

  const folderName = entry?.folderId ? (folderMap[entry.folderId] ?? 'Unknown') : 'Root';

  return (
    <Sheet open={!!entryId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl flex flex-col">
        {isLoading && (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {entry && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-8">{entry.title}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-muted">
                  <Badge variant={versionBadgeVariant[entry.versionState] ?? 'historical'}>
                    {entry.versionState.charAt(0).toUpperCase() + entry.versionState.slice(1)} v
                    {entry.version}
                  </Badge>
                  <span>Deleted {format(new Date(entry.updatedAt), 'MMM d, yyyy')}</span>
                  <span className="inline-flex items-center gap-1">
                    <FolderOpen className="size-3.5" />
                    {folderName}
                  </span>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              {entry.systemMessage && (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground-muted">System Message</span>
                  <MarkdownEditor
                    content={entry.systemMessage}
                    onContentChange={() => {}}
                    editable={false}
                    templateHighlight={isTemplate}
                    minHeightClass="min-h-[60px]"
                  />
                </div>
              )}

              {entry.prompts.map((prompt, i) => (
                <div key={prompt.id} className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground-muted">
                    Prompt {entry.prompts.length > 1 ? i + 1 : ''}
                  </span>
                  <MarkdownEditor
                    content={prompt.content}
                    onContentChange={() => {}}
                    editable={false}
                    templateHighlight={isTemplate}
                    minHeightClass="min-h-[60px]"
                  />
                </div>
              ))}

              {isTemplate && (
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground-muted">
                    Template Variables
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {templateFields.map((field) => (
                      <Badge key={field.name} variant="secondary">
                        {`{{${field.name}}}`}
                        {field.type !== 'string' && (
                          <span className="ml-1 opacity-60">({field.type})</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <SheetFooter className="border-t border-border-subtle pt-4">
              <Button variant="outline" disabled={isBusy} onClick={handleRestore}>
                <Undo2 className="mr-1.5 size-4" />
                Restore
              </Button>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isBusy}>
                      <Trash2 className="mr-1.5 size-4" />
                      Delete permanently
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Permanently delete "{entry.title}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This entry will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
