import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useCallback, useState } from 'react';

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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { handleApiError } from '@/lib/handleApiError';
import type { TestDatasetRow } from '@/services/api/testDatasetService';
import * as testDatasetService from '@/services/api/testDatasetService';
import type { TemplateField } from '@/types';

interface DatasetRowEditorProps {
  entryId: string;
  datasetId: string;
  datasetName: string;
  templateFields: TemplateField[];
  onBack: () => void;
}

export default function DatasetRowEditor({
  entryId,
  datasetId,
  datasetName,
  templateFields,
  onBack,
}: DatasetRowEditorProps) {
  const queryClient = useQueryClient();
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [addingRow, setAddingRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<TestDatasetRow | null>(null);

  const queryKey = ['dataset', entryId, datasetId];

  const { data: dataset, isLoading } = useQuery({
    queryKey,
    queryFn: () => testDatasetService.getDataset(entryId, datasetId),
  });

  const addRowMutation = useMutation({
    mutationFn: (values: Record<string, string>) =>
      testDatasetService.addRow(entryId, datasetId, values),
    onSuccess: () => {
      setAddingRow(false);
      setNewRowValues({});
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['datasets', entryId] });
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to add row' }),
  });

  const updateRowMutation = useMutation({
    mutationFn: ({ rowId, values }: { rowId: string; values: Record<string, string> }) =>
      testDatasetService.updateRow(entryId, datasetId, rowId, values),
    onSuccess: () => {
      setEditingRowId(null);
      setEditValues({});
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to update row' }),
  });

  const deleteRowMutation = useMutation({
    mutationFn: (rowId: string) => testDatasetService.deleteRow(entryId, datasetId, rowId),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['datasets', entryId] });
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to delete row' }),
  });

  const generateMutation = useMutation({
    mutationFn: (count: number) => testDatasetService.generateRows(entryId, datasetId, count),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['datasets', entryId] });
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to generate rows' }),
  });

  const buildDefaultValues = useCallback(() => {
    const defaults: Record<string, string> = {};
    for (const field of templateFields) {
      defaults[field.name] = field.defaultValue ?? '';
    }
    return defaults;
  }, [templateFields]);

  function startAddRow() {
    setNewRowValues(buildDefaultValues());
    setAddingRow(true);
  }

  function startEditRow(row: TestDatasetRow) {
    setEditingRowId(row.id);
    setEditValues({ ...row.values });
  }

  function renderFieldInput(
    field: TemplateField,
    values: Record<string, string>,
    onChange: (name: string, value: string) => void
  ) {
    const value = values[field.name] ?? '';

    if (field.type === 'enum' && field.enumValues.length > 0) {
      return (
        <Select value={value} onValueChange={(v) => onChange(field.name, v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.enumValues.map((ev) => (
              <SelectItem key={ev} value={ev}>
                {ev}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        className="h-8 text-xs"
        type={field.type === 'int' || field.type === 'float' ? 'number' : 'text'}
        min={field.min ?? undefined}
        max={field.max ?? undefined}
        step={field.type === 'float' ? '0.1' : undefined}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  const rows = dataset?.rows ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="size-7 p-0">
            <ArrowLeft className="size-3.5" />
          </Button>
          <h3 className="text-sm font-medium">{datasetName}</h3>
          <span className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate(5)}
            disabled={generateMutation.isPending || templateFields.length === 0}
          >
            {generateMutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 size-3.5" />
            )}
            Generate with AI
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={startAddRow}
            disabled={addingRow || templateFields.length === 0}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add Row
          </Button>
        </div>
      </div>

      {templateFields.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            This entry has no template fields. Add template variables (e.g.{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{'{{name}}'}</code>) to your
            prompts first.
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 text-xs">#</TableHead>
                {templateFields.map((f) => (
                  <TableHead key={f.name} className="text-xs">
                    {f.name}
                    <span className="ml-1 text-muted-foreground">({f.type})</span>
                  </TableHead>
                ))}
                <TableHead className="w-20 text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Add row form */}
              {addingRow && (
                <TableRow className="bg-primary/5">
                  <TableCell className="text-xs text-muted-foreground">new</TableCell>
                  {templateFields.map((f) => (
                    <TableCell key={f.name}>
                      {renderFieldInput(f, newRowValues, (name, value) =>
                        setNewRowValues((prev) => ({ ...prev, [name]: value }))
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        onClick={() => addRowMutation.mutate(newRowValues)}
                        disabled={addRowMutation.isPending}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        onClick={() => {
                          setAddingRow(false);
                          setNewRowValues({});
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {rows.length === 0 && !addingRow ? (
                <TableRow>
                  <TableCell
                    colSpan={templateFields.length + 2}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No rows yet. Add rows manually or generate with AI.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                    {templateFields.map((f) => (
                      <TableCell key={f.name}>
                        {editingRowId === row.id ? (
                          renderFieldInput(f, editValues, (name, value) =>
                            setEditValues((prev) => ({ ...prev, [name]: value }))
                          )
                        ) : (
                          <span className="text-xs">{row.values[f.name] ?? '—'}</span>
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      {editingRowId === row.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0 text-primary"
                            onClick={() =>
                              updateRowMutation.mutate({ rowId: row.id, values: editValues })
                            }
                            disabled={updateRowMutation.isPending}
                          >
                            ✓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0"
                            onClick={() => {
                              setEditingRowId(null);
                              setEditValues({});
                            }}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0"
                            onClick={() => startEditRow(row)}
                          >
                            <span className="text-xs">Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      )}

      {/* Delete Row Confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Row?</AlertDialogTitle>
            <AlertDialogDescription>
              This row will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteRowMutation.mutate(deleteTarget.id)}
              disabled={deleteRowMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
