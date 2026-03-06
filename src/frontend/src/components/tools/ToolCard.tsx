import { memo, useState } from "react";
import type { ToolDescription } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";

interface ToolCardProps {
  tool: ToolDescription;
  onUpdate: (id: string, data: Partial<Omit<ToolDescription, "id">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TOOL_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_.-]*$/;

export const ToolCard = memo(function ToolCard({ tool, onUpdate, onDelete }: ToolCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(tool.name);
  const [toolName, setToolName] = useState(tool.toolName);
  const [description, setDescription] = useState(tool.description);
  const [saving, setSaving] = useState(false);

  const toolNameValid = TOOL_NAME_RE.test(toolName);
  const formValid = name.trim() !== "" && toolName.trim() !== "" && toolNameValid && description.trim() !== "";

  const handleEdit = async () => {
    if (!formValid) return;
    setSaving(true);
    await onUpdate(tool.id, { name: name.trim(), toolName: toolName.trim(), description: description.trim() });
    setSaving(false);
    setEditOpen(false);
  };

  const openEdit = () => {
    setName(tool.name);
    setToolName(tool.toolName);
    setDescription(tool.description);
    setEditOpen(true);
  };

  return (
    <>
      <Card className="group bg-card elevation-2 border-border-subtle rounded-xl overflow-hidden border-t-2 border-t-primary transition-lift hover:elevation-3 hover:-translate-y-0.5">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{tool.name}</CardTitle>
            <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity duration-150">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openEdit}>
                <Pencil className="size-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {tool.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the tool description. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(tool.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <span className="font-mono text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md w-fit">{tool.toolName}</span>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm text-foreground-secondary line-clamp-2">{tool.description}</p>
          <ToolParamSummary schema={tool.inputSchema} />
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-toolName">Tool Name</Label>
              <Input id="edit-toolName" value={toolName} onChange={(e) => setToolName(e.target.value)} className="font-mono" />
              {toolName && !toolNameValid && (
                <p className="text-[0.8rem] font-medium text-error-text">Only letters, numbers, underscores, dots, and hyphens</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!formValid || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

function ToolParamSummary({ schema }: { schema?: Record<string, unknown> }) {
  if (!schema) return null;
  const properties = schema.properties as Record<string, { type?: string }> | undefined;
  if (!properties) return null;

  const required = new Set(
    Array.isArray(schema.required) ? (schema.required as string[]) : [],
  );

  const params = Object.entries(properties).map(([name, def]) => {
    const type = def?.type ?? "any";
    const req = required.has(name) ? ", required" : "";
    return `${name} (${type}${req})`;
  });

  if (params.length === 0) return null;

  return (
    <p className="text-xs text-foreground-muted/70 line-clamp-1">
      Parameters: {params.join(", ")}
    </p>
  );
}
