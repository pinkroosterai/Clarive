import { useMemo, useCallback } from "react";
import { Plus } from "lucide-react";

import type { PromptEntry, Prompt } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SystemMessageSection } from "./SystemMessageSection";
import { PromptCard } from "./PromptCard";
import { UnifiedTemplateForm } from "./UnifiedTemplateForm";

interface PromptEditorProps {
  entry: PromptEntry;
  onChange: (updated: Partial<PromptEntry>, options?: { force?: boolean }) => void;
  isReadOnly: boolean;
}

function generateLocalId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function PromptEditor({ entry, onChange, isReadOnly }: PromptEditorProps) {
  const sortedPrompts = useMemo(
    () => [...entry.prompts].sort((a, b) => a.order - b.order),
    [entry.prompts],
  );

  const updatePrompt = useCallback((updated: Prompt) => {
    onChange({
      prompts: entry.prompts.map((p) => (p.id === updated.id ? updated : p)),
    });
  }, [entry.prompts, onChange]);

  const deletePrompt = useCallback((id: string) => {
    const remaining = entry.prompts
      .filter((p) => p.id !== id)
      .map((p, i) => ({ ...p, order: i }));
    onChange({ prompts: remaining }, { force: true });
  }, [entry.prompts, onChange]);

  const movePrompt = useCallback((id: string, direction: -1 | 1) => {
    const sorted = [...entry.prompts].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((p) => p.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const updated = sorted.map((p, i) => {
      if (i === idx) return { ...p, order: sorted[swapIdx].order };
      if (i === swapIdx) return { ...p, order: sorted[idx].order };
      return p;
    });
    onChange({ prompts: updated }, { force: true });
  }, [entry.prompts, onChange]);

  const addPrompt = () => {
    const newPrompt: Prompt = {
      id: generateLocalId(),
      content: "",
      order: entry.prompts.length,
    };
    onChange({ prompts: [...entry.prompts, newPrompt] }, { force: true });
  };

  return (
    <div className="space-y-6" data-tour="prompt-editor">
      <Input
        value={entry.title}
        onChange={(e) => onChange({ title: e.target.value })}
        disabled={isReadOnly}
        placeholder="Entry title"
        className="text-lg font-semibold h-12"
      />

      <SystemMessageSection
        systemMessage={entry.systemMessage}
        onChange={(value) => {
          // Adding or removing system message is a structural change
          const isStructural = value === null || entry.systemMessage === null;
          onChange({ systemMessage: value }, isStructural ? { force: true } : undefined);
        }}
        isReadOnly={isReadOnly}
      />

      <div className="space-y-4">
        {sortedPrompts.map((prompt, i) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            index={i + 1}
            isOnly={sortedPrompts.length === 1}
            isLast={i === sortedPrompts.length - 1}
            isReadOnly={isReadOnly}
            onUpdate={updatePrompt}
            onDelete={() => deletePrompt(prompt.id)}
            onMoveUp={() => movePrompt(prompt.id, -1)}
            onMoveDown={() => movePrompt(prompt.id, 1)}
          />
        ))}
      </div>

      {!isReadOnly && (
        <Button variant="outline" className="gap-2" onClick={addPrompt}>
          <Plus className="size-4" />
          Add follow-up prompt
        </Button>
      )}

      <UnifiedTemplateForm
        prompts={sortedPrompts}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}
