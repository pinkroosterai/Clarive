import { diffLines } from 'diff';
import { Check, Loader2, Pencil, Sparkles } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAiEnabled } from '@/hooks/useAiEnabled';
import { handleApiError } from '@/lib/handleApiError';
import { wizardService } from '@/services';
import type { PromptEntry } from '@/types';

type Choice = 'mine' | 'theirs' | 'merged';

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

function HighlightedColumn({
  text,
  otherText,
  side,
}: {
  text: string;
  otherText: string;
  side: 'mine' | 'theirs';
}) {
  const changes = useMemo(() => diffLines(otherText, text), [otherText, text]);
  return (
    <div className="rounded-md border border-border-subtle bg-elevated p-3 font-mono text-xs whitespace-pre-wrap min-h-[80px] max-h-[400px] overflow-y-auto">
      {changes.map((part, i) => {
        // For "mine" column: added = lines unique to mine (green)
        // For "theirs" column: removed from diff(theirs, mine) means unique to theirs (green)
        const isHighlighted = side === 'mine' ? part.added : part.removed;
        const isOtherSide = side === 'mine' ? part.removed : part.added;

        if (isOtherSide) return null; // Don't show lines from the other side

        return (
          <div key={i} className={isHighlighted ? 'bg-success-bg text-success-text' : ''}>
            {part.value
              .split('\n')
              .filter((line, j, arr) => j < arr.length - 1 || line !== '')
              .map((line, j) => (
                <div key={j}>{line || '\u00A0'}</div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function FieldConflict({
  field,
  choice,
  onChoiceChange,
  mergedText,
  onMergedTextChange,
  aiEnabled,
  aiLoading,
  onAiResolve,
}: {
  field: FieldDiff;
  choice: Choice;
  onChoiceChange: (choice: Choice) => void;
  mergedText: string;
  onMergedTextChange: (text: string) => void;
  aiEnabled: boolean;
  aiLoading: boolean;
  onAiResolve: () => void;
}) {
  const resolvedText =
    choice === 'merged' ? mergedText : choice === 'theirs' ? field.theirs : field.mine;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{field.label}</h3>
        <div className="flex gap-1">
          <Button
            variant={choice === 'mine' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onChoiceChange('mine')}
            disabled={aiLoading}
          >
            {choice === 'mine' && <Check className="h-3 w-3" />}
            Keep mine
          </Button>
          <Button
            variant={choice === 'theirs' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => onChoiceChange('theirs')}
            disabled={aiLoading}
          >
            {choice === 'theirs' && <Check className="h-3 w-3" />}
            Keep theirs
          </Button>
          <Button
            variant={choice === 'merged' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={aiLoading}
            onClick={() => {
              if (choice !== 'merged') {
                // Pre-fill with currently selected version
                onMergedTextChange(choice === 'theirs' ? field.theirs : field.mine);
              }
              onChoiceChange('merged');
            }}
          >
            {choice === 'merged' && <Pencil className="h-3 w-3" />}
            Edit merged
          </Button>
          {aiEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={aiLoading}
              onClick={onAiResolve}
            >
              {aiLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {aiLoading ? 'Merging...' : 'Resolve with AI'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Your changes</div>
          <HighlightedColumn text={field.mine} otherText={field.theirs} side="mine" />
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Server version</div>
          <HighlightedColumn text={field.theirs} otherText={field.mine} side="theirs" />
        </div>
      </div>

      {choice === 'merged' && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Merged result</div>
          <textarea
            className="w-full rounded-md border border-border-subtle p-3 font-mono text-xs min-h-[120px] bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            value={mergedText}
            onChange={(e) => onMergedTextChange(e.target.value)}
          />
        </div>
      )}

      {/* Live result preview */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1.5">Result preview</div>
        <div className="rounded-md border border-primary/20 bg-elevated p-3 font-mono text-xs whitespace-pre-wrap min-h-[40px]">
          {resolvedText || <span className="text-muted-foreground italic">Empty</span>}
        </div>
      </div>
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
  const aiEnabled = useAiEnabled();

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

  const [mergedTexts, setMergedTexts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of diffFields) {
      initial[f.key] = f.mine;
    }
    return initial;
  });

  const [aiLoadingFields, setAiLoadingFields] = useState<Record<string, boolean>>({});

  const handleAiResolve = useCallback(
    async (field: FieldDiff) => {
      setAiLoadingFields((prev) => ({ ...prev, [field.key]: true }));
      try {
        const merged = await wizardService.resolveMergeConflict(
          field.label,
          field.mine,
          field.theirs
        );
        setMergedTexts((prev) => ({ ...prev, [field.key]: merged }));
        setChoices((prev) => ({ ...prev, [field.key]: 'merged' }));
      } catch (err) {
        handleApiError(err, { title: 'AI merge failed' });
      } finally {
        setAiLoadingFields((prev) => ({ ...prev, [field.key]: false }));
      }
    },
    []
  );

  const handleResolve = () => {
    const resolved: Partial<PromptEntry> = {};

    for (const field of fields) {
      const choice = choices[field.key] ?? 'mine';
      let value: string;
      if (choice === 'merged') {
        value = mergedTexts[field.key] ?? field.mine;
      } else {
        value = choice === 'mine' ? field.mine : field.theirs;
      }

      if (field.key === 'title') {
        resolved.title = value;
      } else if (field.key === 'systemMessage') {
        resolved.systemMessage = value || null;
      }
    }

    const maxPrompts = Math.max(localEntry.prompts?.length ?? 0, serverEntry.prompts?.length ?? 0);
    const prompts = [];
    for (let i = 0; i < maxPrompts; i++) {
      const choice = choices[`prompt-${i}`] ?? 'mine';
      let content: string;
      if (choice === 'merged') {
        content = mergedTexts[`prompt-${i}`] ?? localEntry.prompts?.[i]?.content ?? '';
      } else {
        const source = choice === 'mine' ? localEntry : serverEntry;
        content = source.prompts?.[i]?.content ?? '';
      }
      const basePrompt = localEntry.prompts?.[i] ?? serverEntry.prompts?.[i];
      if (basePrompt) {
        prompts.push({ ...basePrompt, content, order: i });
      }
    }
    resolved.prompts = prompts;

    onResolve(resolved);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="border-b border-border-subtle px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Resolve conflict</h1>
          <p className="text-sm text-muted-foreground">
            Someone else saved changes while you were editing. {diffFields.length} conflicting
            field{diffFields.length !== 1 ? 's' : ''} — choose which version to keep or edit the
            merged result.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 ml-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleResolve}>Save resolved</Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-73px)]">
        <div className="max-w-6xl mx-auto p-6 space-y-8">
          {fields.map((field) =>
            field.hasDiff ? (
              <FieldConflict
                key={field.key}
                field={field}
                choice={choices[field.key] ?? 'mine'}
                onChoiceChange={(c) => setChoices((prev) => ({ ...prev, [field.key]: c }))}
                mergedText={mergedTexts[field.key] ?? field.mine}
                onMergedTextChange={(t) =>
                  setMergedTexts((prev) => ({ ...prev, [field.key]: t }))
                }
                aiEnabled={aiEnabled}
                aiLoading={aiLoadingFields[field.key] ?? false}
                onAiResolve={() => handleAiResolve(field)}
              />
            ) : (
              <div key={field.key} className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground">{field.label}</h3>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  No changes
                </span>
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
