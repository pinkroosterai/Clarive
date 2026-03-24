import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Database, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';

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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { handleApiError } from '@/lib/handleApiError';
import type { TestDataset } from '@/services/api/testDatasetService';
import * as testDatasetService from '@/services/api/testDatasetService';

const datasetNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or fewer');

interface DatasetPanelProps {
  entryId: string;
  onSelectDataset: (datasetId: string) => void;
  selectedDatasetId?: string | null;
}

export default function DatasetPanel({
  entryId,
  onSelectDataset,
  selectedDatasetId,
}: DatasetPanelProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TestDataset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestDataset | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets', entryId],
    queryFn: () => testDatasetService.getDatasets(entryId),
  });

  const createMutation = useMutation({
    mutationFn: (datasetName: string) => testDatasetService.createDataset(entryId, datasetName),
    onSuccess: (result) => {
      setCreateOpen(false);
      setName('');
      setNameError(null);
      queryClient.invalidateQueries({ queryKey: ['datasets', entryId] });
      onSelectDataset(result.id);
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to create dataset' }),
  });

  const renameMutation = useMutation({
    mutationFn: ({ datasetId, newName }: { datasetId: string; newName: string }) =>
      testDatasetService.updateDataset(entryId, datasetId, newName),
    onSuccess: () => {
      setRenameTarget(null);
      setName('');
      setNameError(null);
      queryClient.invalidateQueries({ queryKey: ['datasets', entryId] });
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to rename dataset' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (datasetId: string) => testDatasetService.deleteDataset(entryId, datasetId),
    onSuccess: () => {
      const deletedId = deleteTarget?.id;
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['datasets', entryId] });
      if (selectedDatasetId === deletedId) {
        onSelectDataset('');
      }
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to delete dataset' }),
  });

  function handleSubmitCreate() {
    const validation = datasetNameSchema.safeParse(name);
    if (!validation.success) {
      setNameError(validation.error.errors[0].message);
      return;
    }
    createMutation.mutate(name.trim());
  }

  function handleSubmitRename() {
    if (!renameTarget) return;
    const validation = datasetNameSchema.safeParse(name);
    if (!validation.success) {
      setNameError(validation.error.errors[0].message);
      return;
    }
    renameMutation.mutate({ datasetId: renameTarget.id, newName: name.trim() });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Test Datasets</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setName('');
            setNameError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          New Dataset
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !datasets?.length ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
          <Database className="size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No test datasets yet</p>
          <p className="text-xs text-muted-foreground/70">
            Create a dataset to define reusable test inputs for A/B testing
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {datasets.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDataset(d.id)}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${
                selectedDatasetId === d.id ? 'border-primary/30 bg-primary/5' : 'border-transparent'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Database className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{d.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {d.rowCount} {d.rowCount === 1 ? 'row' : 'rows'}
                  </span>
                </div>
                <p className="mt-0.5 pl-5.5 text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="size-7 p-0">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem
                    onClick={() => {
                      setName(d.name);
                      setNameError(null);
                      setRenameTarget(d);
                    }}
                  >
                    <Pencil className="mr-2 size-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(d)}
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </button>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Test Dataset</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Dataset name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitCreate()}
            autoFocus
          />
          {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Dataset</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Dataset name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitRename()}
            autoFocus
          />
          {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRename} disabled={renameMutation.isPending}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{deleteTarget?.name}&rdquo; and all its rows? This cannot be undone.
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
    </div>
  );
}
