import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, Plus, RefreshCw, Server, Trash2 } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { handleApiError } from '@/lib/handleApiError';
import { mcpServerService } from '@/services';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function McpServersPanel() {
  const queryClient = useQueryClient();
  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: mcpServerService.list,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [bearerToken, setBearerToken] = useState('');

  const formValid = name.trim() !== '' && url.trim() !== '';

  const createMutation = useMutation({
    mutationFn: (data: { name: string; url: string; bearerToken?: string }) =>
      mcpServerService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
      toast.success('MCP server added');
      resetAndClose();
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to add MCP server' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mcpServerService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      toast.success('MCP server removed');
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to remove MCP server' }),
  });

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSync = useCallback(
    async (id: string) => {
      setSyncingId(id);
      try {
        await mcpServerService.sync(id);
        queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
        queryClient.invalidateQueries({ queryKey: ['tools'] });
        toast.success('Sync complete');
      } catch (err) {
        handleApiError(err, { fallback: 'Sync failed' });
        queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
      } finally {
        setSyncingId(null);
      }
    },
    [queryClient]
  );

  const resetAndClose = () => {
    setName('');
    setUrl('');
    setBearerToken('');
    setAddOpen(false);
  };

  const handleCreate = () => {
    if (!formValid) return;
    createMutation.mutate({
      name: name.trim(),
      url: url.trim(),
      bearerToken: bearerToken.trim() || undefined,
    });
  };

  return (
    <div className="space-y-4 mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight">MCP Servers</h3>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            if (!open) resetAndClose();
            else setAddOpen(true);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="size-4 mr-1" /> Add Server
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add MCP Server</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mcp-name">Name</Label>
                <Input
                  id="mcp-name"
                  placeholder="e.g. Context7"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-url">Server URL</Label>
                <Input
                  id="mcp-url"
                  placeholder="https://mcp-server.example.com/mcp"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mcp-token">Bearer Token (optional)</Label>
                <Input
                  id="mcp-token"
                  type="password"
                  placeholder="Token for authenticated servers"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formValid || createMutation.isPending}>
                {createMutation.isPending ? 'Adding…' : 'Add Server'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-foreground-muted text-sm py-4">
          <Loader2 className="size-4 animate-spin" />
          Loading servers…
        </div>
      ) : servers.length === 0 ? (
        <Card className="bg-surface border-2 border-dashed border-border rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Server className="size-8 text-foreground-muted/50 mb-2" />
            <p className="text-sm text-foreground-muted">
              No MCP servers configured. Add a server to automatically sync tool definitions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {servers.map((server) => (
            <Card
              key={server.id}
              className="bg-card border-border-subtle rounded-xl overflow-hidden"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-sm">{server.name}</CardTitle>
                    <p className="text-xs font-mono text-foreground-muted truncate mt-0.5">
                      {server.url}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleSync(server.id)}
                      disabled={syncingId === server.id}
                      title="Sync now"
                    >
                      <RefreshCw
                        className={`size-3.5 ${syncingId === server.id ? 'animate-spin' : ''}`}
                      />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {server.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the server and delete all {server.toolCount} synced
                            tool{server.toolCount !== 1 ? 's' : ''}. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(server.id)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-xs text-foreground-muted">
                  <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                    {server.toolCount} tool{server.toolCount !== 1 ? 's' : ''}
                  </span>
                  <span>Synced {timeAgo(server.lastSyncedAt)}</span>
                  {server.lastSyncError && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertCircle className="size-3.5 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs text-xs">{server.lastSyncError}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
