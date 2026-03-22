import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Trash2, RefreshCw, Link, Eye, EyeOff } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/services/api/apiClient';
import { createShareLink, getShareLink, revokeShareLink } from '@/services/api/shareLinkService';
import type { CreateShareLinkRequest } from '@/types/shareLink';

interface ShareDialogProps {
  entryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ entryId, open, onOpenChange }: ShareDialogProps) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiry, setUseExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const linkQuery = useQuery({
    queryKey: ['share-link', entryId],
    queryFn: () => getShareLink(entryId),
    enabled: open,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });

  const createMutation = useMutation({
    mutationFn: (req: CreateShareLinkRequest) => createShareLink(entryId, req),
    onSuccess: (data) => {
      setCreatedToken(data.token);
      queryClient.invalidateQueries({ queryKey: ['share-link', entryId] });
      toast.success('Share link created');
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create share link');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeShareLink(entryId),
    onSuccess: () => {
      setCreatedToken(null);
      queryClient.invalidateQueries({ queryKey: ['share-link', entryId] });
      toast.success('Share link revoked');
    },
    onError: (err: Error) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to revoke share link');
    },
  });

  const handleCreate = useCallback(() => {
    const req: CreateShareLinkRequest = {};
    if (useExpiry && expiresAt) req.expiresAt = new Date(expiresAt).toISOString();
    if (usePassword && password) req.password = password;
    createMutation.mutate(req);
  }, [useExpiry, expiresAt, usePassword, password, createMutation]);

  const handleCopy = useCallback(
    async (token?: string) => {
      const t = token ?? createdToken;
      if (!t) return;
      const url = `${window.location.origin}/share/${encodeURIComponent(t)}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      } catch {
        toast.error('Failed to copy to clipboard');
      }
    },
    [createdToken]
  );

  const existingLink = linkQuery.data;
  const hasLink = !!existingLink && !linkQuery.error;

  const shareUrl = createdToken
    ? `${window.location.origin}/share/${encodeURIComponent(createdToken)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            {hasLink ? 'Manage Share Link' : 'Share Link'}
          </DialogTitle>
        </DialogHeader>

        {hasLink && !createdToken ? (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-green-600 dark:text-green-400">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Views</span>
                <span className="font-medium">{existingLink.accessCount}</span>
              </div>
              {existingLink.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-medium">
                    {new Date(existingLink.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {existingLink.hasPassword && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Password</span>
                  <span className="font-medium">Protected</span>
                </div>
              )}
              {existingLink.pinnedVersion && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium">Pinned to v{existingLink.pinnedVersion}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {new Date(existingLink.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(existingLink.token)}
                className="w-full"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy Link
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleCreate();
                  }}
                  disabled={createMutation.isPending}
                  className="flex-1"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerate
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => revokeMutation.mutate()}
                  disabled={revokeMutation.isPending}
                  className="flex-1"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Revoke
                </Button>
              </div>
            </div>
          </div>
        ) : createdToken ? (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Share URL</Label>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl ?? ''} className="text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={() => handleCopy()}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Anyone with this link can view the prompt. The token is shown only once.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setCreatedToken(null);
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a shareable link that gives read-only access to this prompt without requiring
              an account.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="use-expiry" className="text-sm">
                  Set expiration
                </Label>
                <Switch id="use-expiry" checked={useExpiry} onCheckedChange={setUseExpiry} />
              </div>
              {useExpiry && (
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="use-password" className="text-sm">
                  Password protect
                </Label>
                <Switch id="use-password" checked={usePassword} onCheckedChange={setUsePassword} />
              </div>
              {usePassword && (
                <>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && password.length < 12 && (
                    <p className="text-xs text-muted-foreground">Minimum 12 characters</p>
                  )}
                </>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={createMutation.isPending || (usePassword && password.length < 12)}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Share Link'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
