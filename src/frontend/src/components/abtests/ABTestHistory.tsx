import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { handleApiError } from '@/lib/handleApiError';
import type { AbTestRun } from '@/services/api/abTestService';
import * as abTestService from '@/services/api/abTestService';

interface ABTestHistoryProps {
  entryId: string;
  onSelectRun: (runId: string) => void;
}

const statusVariant: Record<string, 'default' | 'destructive' | 'secondary'> = {
  Completed: 'default',
  Failed: 'destructive',
  Running: 'secondary',
  Pending: 'secondary',
};

export default function ABTestHistory({ entryId, onSelectRun }: ABTestHistoryProps) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<AbTestRun | null>(null);

  const { data: runs, isLoading } = useQuery({
    queryKey: ['abtests', entryId],
    queryFn: () => abTestService.getAbTests(entryId),
  });

  const deleteMutation = useMutation({
    mutationFn: (runId: string) => abTestService.deleteAbTest(entryId, runId),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['abtests', entryId] });
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to delete test' }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!runs?.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">No A/B tests yet for this entry.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Versions</TableHead>
            <TableHead className="text-xs">Dataset</TableHead>
            <TableHead className="text-xs">Model</TableHead>
            <TableHead className="text-xs">Status</TableHead>
            <TableHead className="text-xs">Results</TableHead>
            <TableHead className="w-10 text-xs" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id} className="cursor-pointer" onClick={() => onSelectRun(run.id)}>
              <TableCell className="text-xs">
                {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-xs font-medium">
                {run.versionALabel} vs {run.versionBLabel}
              </TableCell>
              <TableCell className="text-xs">{run.datasetName ?? '—'}</TableCell>
              <TableCell className="text-xs">{run.model}</TableCell>
              <TableCell>
                <Badge variant={statusVariant[run.status] ?? 'secondary'} className="text-xs">
                  {run.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{run.resultCount}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(run);
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete A/B Test?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the test run and all its results. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
