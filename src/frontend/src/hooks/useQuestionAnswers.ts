import { useState, useEffect } from 'react';

import type { ClarificationQuestion } from '@/types';

export function useQuestionAnswers(questions: ClarificationQuestion[], enhancements: string[]) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([]);

  useEffect(() => {
    setAnswers(questions.map(() => ''));
    setSelectedEnhancements([]);
  }, [questions, enhancements]);

  const updateAnswer = (idx: number, value: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === idx ? value : a)));
  };

  const selectSuggestion = (idx: number, suggestion: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === idx ? suggestion : a)));
  };

  const toggleEnhancement = (name: string) => {
    setSelectedEnhancements((prev) =>
      prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]
    );
  };

  return {
    answers,
    selectedEnhancements,
    updateAnswer,
    selectSuggestion,
    toggleEnhancement,
  };
}
