import { ArrowRight, SkipForward } from "lucide-react";

import type { ClarificationQuestion } from "@/types";
import { useQuestionAnswers } from "@/hooks/useQuestionAnswers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ClarifyStepProps {
  questions: ClarificationQuestion[];
  enhancements: string[];
  onContinue: (
    answers: Array<{ questionIndex: number; answer: string }>,
    selectedEnhancements: string[],
  ) => void;
  onSkip: () => void;
  isLoading: boolean;
}

export function ClarifyStep({
  questions,
  enhancements,
  onContinue,
  onSkip,
  isLoading,
}: ClarifyStepProps) {
  const {
    answers,
    selectedEnhancements,
    updateAnswer,
    selectSuggestion,
    toggleEnhancement,
  } = useQuestionAnswers(questions, enhancements);

  const handleContinue = () => {
    const structuredAnswers = answers
      .map((answer, i) => ({ questionIndex: i, answer }))
      .filter((a) => a.answer.trim().length > 0);
    onContinue(structuredAnswers, selectedEnhancements);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Help us refine your prompt
        </h2>
        <p className="text-sm text-foreground-muted">
          Answer these questions to get a better result, or skip to generate immediately.
        </p>
      </div>

      {questions.length > 0 && (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <div
              key={i}
              className="bg-surface rounded-xl border border-border-subtle p-4 space-y-3"
            >
              <Label className="text-sm font-medium text-foreground">{q.text}</Label>

              {q.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {q.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => selectSuggestion(i, suggestion)}
                      disabled={isLoading}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        answers[i] === suggestion
                          ? "bg-primary/15 border-primary/50 text-primary font-medium"
                          : "bg-elevated border-border hover:border-primary/30 text-foreground-muted"
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
                placeholder="Type your own answer..."
                disabled={isLoading}
                className="bg-elevated border-border focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
          ))}
        </div>
      )}

      {enhancements.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Suggested Enhancements
          </h3>
          {enhancements.map((enh) => (
            <label key={enh} className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={selectedEnhancements.includes(enh)}
                onCheckedChange={() => toggleEnhancement(enh)}
                disabled={isLoading}
                className="mt-0.5"
              />
              <span className="text-sm">{enh}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          className="gap-2 hover:border-primary/30"
          onClick={onSkip}
          disabled={isLoading}
        >
          <SkipForward className="size-4" />
          Skip
        </Button>
        <Button className="gap-2" onClick={handleContinue} disabled={isLoading}>
          <ArrowRight className="size-4" />
          Continue
        </Button>
      </div>
    </div>
  );
}
