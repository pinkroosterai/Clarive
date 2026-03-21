import { diffLines } from 'diff';
import { Check } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PromptEntry } from '@/types';

type Choice = 'mine' | 'theirs';

interface FieldDiff {
  label: string;
  key: string;
  mine: string;
  theirs: string;
  hasDiff: boolean;
}

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localEntry: PromptEntry;
  serverEntry: PromptEntry;
  onResolve: (resolved: Partial<PromptEntry>) => void;
}

function DiffDisplay({ mine, theirs }: { mine: string; theirs: string }) {
  const changes = useMemo(() => diffLines(theirs, mine), [mine, theirs]);
  return (
    <div className="rounded-md border border-border-subtle bg-elevated p-3 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-48">
      {changes.map((part, i) => {
        if (part.added) {
          return (
            <div key={i} className="bg-success-bg text-success-text">
              {part.value
                .split('\n')
                .filter((line, j, arr) => j < arr.length - 1 || line !== '')
                .map((line, j) => (
                  <div key={j}>+ {line}</div>
                ))}
            </div>
          );
        }
        if (part.removed) {
          return (
            <div key={i} className="bg-error-bg text-error-text">
              {part.value
                .split('\n')
                .filter((line, j, arr) => j < arr.length - 1 || line !== '')
                .map((line, j) => (
                  <div key={j}>- {line}</div>
                ))}
            </div>
          );
        }
        return (
          <div key={i} className="text-foreground-muted">
            {part.value
              .split('\n')
              .filter((line, j, arr) => j < arr.length - 1 || line !== '')
              .map((line, j) => (
                <div key={j}>&nbsp; {line}</div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  localEntry,
  serverEntry,
  onResolve,
}: ConflictResolutionDialogProps) {
  const fields = useMemo<FieldDiff[]>(() => {
    const result: FieldDiff[] = [];

    result.push({
      label: 'Title',
      key: 'title',
      mine: localEntry.title ?? '',
      theirs: serverEntry.title ?? '',
      hasDiff: (localEntry.title ?? '') !== (serverEntry.title ?? ''),
    });

    result.push({
      label: 'System Message',
      key: 'systemMessage',
      mine: localEntry.systemMessage ?? '',
      theirs: serverEntry.systemMessage ?? '',
      hasDiff: (localEntry.systemMessage ?? '') !== (serverEntry.systemMessage ?? ''),
    });

    const maxPrompts = Math.max(localEntry.prompts?.length ?? 0, serverEntry.prompts?.length ?? 0);
    for (let i = 0; i < maxPrompts; i++) {
      const mine = localEntry.prompts?.[i]?.content ?? '';
      const theirs = serverEntry.prompts?.[i]?.content ?? '';
      result.push({
        label: `Prompt ${i + 1}`,
        key: `prompt-${i}`,
        mine,
        theirs,
        hasDiff: mine !== theirs,
      });
    }

    return result;
  }, [localEntry, serverEntry]);

  const diffFields = fields.filter((f) => f.hasDiff);

  const [choices, setChoices] = useState<Record<string, Choice>>(() => {
    const initial: Record<string, Choice> = {};
    for (const f of diffFields) {
      initial[f.key] = 'mine';
    }
    return initial;
  });

  const handleResolve = () => {
    const resolved: Partial<PromptEntry> = {};

    for (const field of fields) {
      const choice = choices[field.key] ?? 'mine';
      const value = choice === 'mine' ? field.mine : field.theirs;

      if (field.key === 'title') {
        resolved.title = value;
      } else if (field.key === 'systemMessage') {
        resolved.systemMessage = value || null;
      }
    }

    // Build prompts array from choices
    const maxPrompts = Math.max(localEntry.prompts?.length ?? 0, serverEntry.prompts?.length ?? 0);
    const prompts = [];
    for (let i = 0; i < maxPrompts; i++) {
      const choice = choices[`prompt-${i}`] ?? 'mine';
      const source = choice === 'mine' ? localEntry : serverEntry;
      const prompt = source.prompts?.[i];
      if (prompt) {
        prompts.push({ ...prompt, order: i });
      }
    }
    resolved.prompts = prompts;

    onResolve(resolved);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Conflict detected — resolve changes</DialogTitle>
          <DialogDescription>
            Someone else saved changes while you were editing. Choose which version to keep for each
            field.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-3">
          <div className="space-y-5">
            {fields.map((field) =>
              field.hasDiff ? (
                <div key={field.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{field.label}</h4>
                    <div className="flex gap-1">
                      <Button
                        variant={choices[field.key] === 'mine' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setChoices((prev) => ({ ...prev, [field.key]: 'mine' }))}
                      >
                        {choices[field.key] === 'mine' && <Check className="h-3 w-3" />}
                        Keep mine
                      </Button>
                      <Button
                        variant={choices[field.key] === 'theirs' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setChoices((prev) => ({ ...prev, [field.key]: 'theirs' }))}
                      >
                        {choices[field.key] === 'theirs' && <Check className="h-3 w-3" />}
                        Keep theirs
                      </Button>
                    </div>
                  </div>
                  <DiffDisplay mine={field.mine} theirs={field.theirs} />
                </div>
              ) : (
                <div key={field.key} className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">{field.label}</h4>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    No changes
                  </span>
                </div>
              )
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleResolve}>Save resolved</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
