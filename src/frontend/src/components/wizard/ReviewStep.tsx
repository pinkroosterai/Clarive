import { Loader2, RefreshCw, Check, Coins } from "lucide-react";

import type { PromptEntry, ClarificationQuestion, Evaluation, IterationScore } from "@/types";
import { useQuestionAnswers } from "@/hooks/useQuestionAnswers";
import { PromptEditor } from "@/components/editor/PromptEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { QualityScoreCard } from "./QualityScoreCard";

interface ReviewStepProps {
  draft: PromptEntry;
  questions: ClarificationQuestion[];
  enhancements: string[];
  evaluation?: Evaluation;
  scoreHistory?: IterationScore[];
  onRefine: (answers: string[], selectedEnhancements: string[]) => void;
  onAccept: () => void;
  isRefining: boolean;
}

export function ReviewStep({
  draft,
  questions,
  enhancements,
  evaluation,
  scoreHistory,
  onRefine,
  onAccept,
  isRefining,
}: ReviewStepProps) {
  const {
    answers,
    selectedEnhancements,
    updateAnswer,
    selectSuggestion,
    toggleEnhancement,
  } = useQuestionAnswers(questions, enhancements);

  const noop = () => {};

  return (
    <div className="flex h-full flex-col gap-6 min-h-0 overflow-y-auto">
      {/* Top: prompt preview */}
      <div className="bg-surface rounded-xl border border-border-subtle elevation-1 overflow-hidden p-4">
        <PromptEditor entry={draft} onChange={noop} isReadOnly />
      </div>

      {/* Bottom: evaluation + questions + enhancements + buttons */}
      <div className="w-full space-y-6 bg-surface rounded-xl border border-border-subtle elevation-1 p-5">
        <QualityScoreCard evaluation={evaluation} scoreHistory={scoreHistory} />

        {questions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Clarification Questions</h3>
            {questions.map((q, i) => (
              <div key={i} className="space-y-2">
                <Label className="text-xs text-foreground-secondary">{q.text}</Label>

                {q.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {q.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => selectSuggestion(i, suggestion)}
                        disabled={isRefining}
                        className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                          answers[i] === suggestion
                            ? "bg-primary/15 border-primary/50 text-primary font-medium"
                            : "bg-elevated border-border hover:border-primary/30 text-foreground-secondary"
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                <Input
                  value={answers[i] ?? ""}
                  onChange={(e) => updateAnswer(i, e.target.value)}
                  placeholder="Optional"
                  disabled={isRefining}
                  className="bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
              </div>
            ))}
          </div>
        )}

        {enhancements.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Suggested Enhancements</h3>
            {enhancements.map((enh) => (
              <label key={enh} className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={selectedEnhancements.includes(enh)}
                  onCheckedChange={() => toggleEnhancement(enh)}
                  disabled={isRefining}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground-secondary">{enh}</span>
              </label>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              className="gap-2 hover:border-primary/30"
              onClick={() => onRefine(answers, selectedEnhancements)}
              disabled={isRefining}
            >
              {isRefining ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Refining...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  Refine
                </>
              )}
            </Button>
            <Button className="gap-2" onClick={onAccept} disabled={isRefining}>
              <Check className="size-4" />
              Accept
            </Button>
          </div>
          <p className="text-xs text-right text-foreground-secondary flex items-center justify-end gap-1">
            <Coins className="size-3 text-warning-text" />
            Refine uses 1 credit
          </p>
        </div>
      </div>
    </div>
  );
}
