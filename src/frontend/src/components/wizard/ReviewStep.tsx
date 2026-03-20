import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Check } from 'lucide-react';

import { QualityScoreCard } from './QualityScoreCard';

import { PromptEditor } from '@/components/editor/PromptEditor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuestionAnswers } from '@/hooks/useQuestionAnswers';
import type { PromptEntry, ClarificationQuestion, Evaluation, IterationScore } from '@/types';

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
  const { answers, selectedEnhancements, updateAnswer, selectSuggestion, toggleEnhancement } =
    useQuestionAnswers(questions, enhancements);

  const noop = () => {};

  return (
    <div className="flex flex-col gap-6">
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
                <Label className="text-xs text-foreground-muted">{q.text}</Label>

                {q.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {q.suggestions.map((suggestion) => (
                      <motion.button
                        key={suggestion}
                        type="button"
                        onClick={() => selectSuggestion(i, suggestion)}
                        disabled={isRefining}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          answers[i] === suggestion
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-elevated border-border-subtle hover:bg-accent hover:border-primary/30 text-foreground-muted'
                        }`}
                      >
                        {suggestion}
                      </motion.button>
                    ))}
                  </div>
                )}

                <Input
                  value={answers[i] ?? ''}
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
              <label
                key={enh}
                className={`flex items-start gap-3 cursor-pointer rounded-lg px-3 py-2.5 border transition-colors ${
                  selectedEnhancements.includes(enh)
                    ? 'bg-primary/8 border-primary/30'
                    : 'bg-transparent border-transparent hover:bg-elevated'
                }`}
              >
                <Checkbox
                  checked={selectedEnhancements.includes(enh)}
                  onCheckedChange={() => toggleEnhancement(enh)}
                  disabled={isRefining}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground-muted">{enh}</span>
              </label>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex gap-3 justify-end">
            <Button
              className="gap-2"
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
            <Button
              variant="outline"
              className="gap-2 hover:border-primary/30"
              onClick={onAccept}
              disabled={isRefining}
            >
              <Check className="size-4" />
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
