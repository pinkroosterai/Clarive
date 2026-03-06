import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Wrench } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/EmptyState';
import { McpImportSection } from '@/components/tools/McpImportSection';
import { ToolCard } from '@/components/tools/ToolCard';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { handleApiError } from '@/lib/handleApiError';
import { toolService } from '@/services';
import type { ToolDescription } from '@/types';

const TOOL_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_.-]*$/;

export default function ToolsPanel() {
  const queryClient = useQueryClient();
  const { data: tools, isLoading } = useQuery({
    queryKey: ['tools'],
    queryFn: toolService.getToolsList,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [toolName, setToolName] = useState('');
  const [description, setDescription] = useState('');

  const toolNameValid = toolName === '' || TOOL_NAME_RE.test(toolName);
  const formValid =
    name.trim() !== '' &&
    toolName.trim() !== '' &&
    TOOL_NAME_RE.test(toolName) &&
    description.trim() !== '';

  const createMutation = useMutation({
    mutationFn: (data: Omit<ToolDescription, 'id'>) => toolService.createTool(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      toast.success('Tool created');
      resetAndClose();
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to create tool' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<ToolDescription, 'id'>> }) =>
      toolService.updateTool(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      toast.success('Tool updated');
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to update tool' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => toolService.deleteTool(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tools'] });
      toast.success('Tool deleted');
    },
    onError: (err: unknown) => handleApiError(err, { fallback: 'Failed to delete tool' }),
  });

  const resetAndClose = () => {
    setName('');
    setToolName('');
    setDescription('');
    setAddOpen(false);
  };

  const handleCreate = () => {
    if (!formValid) return;
    createMutation.mutate({
      name: name.trim(),
      toolName: toolName.trim(),
      description: description.trim(),
    });
  };

  const handleUpdate = useCallback(
    async (id: string, data: Partial<Omit<ToolDescription, 'id'>>) => {
      try {
        await updateMutation.mutateAsync({ id, data });
      } catch {
        // onError handler on the mutation displays the toast
      }
    },
    [updateMutation]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
      } catch {
        // onError handler on the mutation displays the toast
      }
    },
    [deleteMutation]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Tool Descriptions</h2>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            if (!open) resetAndClose();
            else setAddOpen(true);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1" /> Add Tool
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tool</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Name</Label>
                <Input
                  id="add-name"
                  placeholder="e.g. Image Generator"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-toolName">Tool Name</Label>
                <Input
                  id="add-toolName"
                  placeholder="e.g. generate_image"
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                  className="font-mono"
                />
                {!toolNameValid && (
                  <p className="text-[0.8rem] font-medium text-error-text">
                    Only letters, numbers, underscores, dots, and hyphens
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-desc">Description</Label>
                <Textarea
                  id="add-desc"
                  placeholder="What does this tool do?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formValid || createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-elevated skeleton-shimmer h-36 border border-border-subtle"
            />
          ))}
        </div>
      ) : tools && tools.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Wrench}
          title="No tools yet"
          description="Add tool descriptions manually or import them from an MCP server."
        />
      )}

      <McpImportSection />
    </div>
  );
}
