import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays, addMonths, format, formatDistanceToNow } from 'date-fns';
import { Copy, Key, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { copyToClipboard } from '@/lib/utils';
import { apiKeyNameSchema } from '@/lib/validationSchemas';
import { apiKeyService } from '@/services';
import { useAuthStore } from '@/store/authStore';

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'No expiration' },
  { value: '30d', label: '30 days' },
  { value: '60d', label: '60 days' },
  { value: '90d', label: '90 days' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
] as const;

function computeExpiresAt(option: string): string | undefined {
  const now = new Date();
  switch (option) {
    case '30d': return addDays(now, 30).toISOString();
    case '60d': return addDays(now, 60).toISOString();
    case '90d': return addDays(now, 90).toISOString();
    case '6m': return addMonths(now, 6).toISOString();
    case '1y': return addMonths(now, 12).toISOString();
    default: return undefined;
  }
}

export default function ApiKeyPanel() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiry, setExpiry] = useState('never');
  const [nameError, setNameError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{ fullKey: string; name: string } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: apiKeyService.getApiKeysList,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, expiresAt }: { name: string; expiresAt?: string }) =>
      apiKeyService.createApiKey(name, expiresAt),
    onSuccess: (result) => {
      if (result.fullKey) {
        setCreatedKey({ fullKey: result.fullKey, name: result.name });
      }
      setKeyName('');
      setExpiry('never');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to create API key' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiKeyService.deleteApiKey(id),
    onSuccess: () => {
      toast.success('API key revoked');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setDeleteTarget(null);
    },
    onError: (err: unknown) => handleApiError(err, { title: 'Failed to revoke API key' }),
  });

  if (currentUser?.role !== 'admin') {
    return (
      <div className="py-12 text-center text-foreground-muted text-sm">
        Only the account admin can manage API keys.
      </div>
    );
  }

  const handleCreateClose = () => {
    setCreateOpen(false);
    setCreatedKey(null);
    setKeyName('');
    setExpiry('never');
    setNameError(null);
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await copyToClipboard(createdKey.fullKey);
      toast.success('Key copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-muted">Manage API keys for external integrations.</p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create API Key
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !keys?.length ? (
        <EmptyState
          icon={Key}
          title="No API keys yet"
          description="Create one to get started with external integrations."
          actions={
            <Link
              to="/help#api-keys"
              className="text-xs text-foreground-muted underline hover:text-foreground"
            >
              Learn more
            </Link>
          }
        />
      ) : (
        <div className="bg-surface rounded-xl elevation-1 border border-border-subtle overflow-clip">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id} className={k.isExpired ? 'opacity-60' : undefined}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {k.name}
                        {k.isExpired && (
                          <span className="text-xs text-destructive font-normal">Expired</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-foreground-muted bg-elevated rounded px-2 py-1">
                        {k.keyPrefix}
                      </span>
                    </TableCell>
                    <TableCell className="text-foreground-muted text-sm">
                      {format(new Date(k.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-foreground-muted text-sm">
                      {k.expiresAt
                        ? k.isExpired
                          ? format(new Date(k.expiresAt), 'MMM d, yyyy')
                          : formatDistanceToNow(new Date(k.expiresAt), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-foreground-muted text-sm">
                      {k.lastUsedAt
                        ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-foreground-muted text-sm text-right tabular-nums">
                      {k.usageCount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ id: k.id, name: k.name })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && handleCreateClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? 'Your new API key is shown below.'
                : 'Give your key a descriptive name to identify its usage.'}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-3">
              <div className="rounded-md border border-warning-border bg-warning-bg p-3">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={createdKey.fullKey}
                    className="font-mono text-sm bg-transparent border-0 focus-visible:ring-0 p-0 h-auto"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-error-text font-medium">
                Copy this key now — it will not be shown again.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder='e.g. "Production", "Staging"'
                value={keyName}
                onChange={(e) => {
                  setKeyName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                maxLength={100}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              <div className="space-y-1">
                <label className="text-sm font-medium">Expiration</label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={handleCreateClose}>Done</Button>
            ) : (
              <Button
                disabled={!keyName.trim() || createMutation.isPending}
                onClick={() => {
                  const result = apiKeyNameSchema.safeParse(keyName.trim());
                  if (!result.success) {
                    setNameError(result.error.issues[0]?.message ?? 'Invalid name');
                    return;
                  }
                  createMutation.mutate({
                    name: keyName.trim(),
                    expiresAt: computeExpiresAt(expiry),
                  });
                }}
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoking this key will immediately break any integrations using it. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
