import { useMemo, useState } from "react";
import type { QuizAnswers, QuizQuestion } from "./types";

interface UseQuizFlowResult {
  currentIndex: number;
  currentQuestion: QuizQuestion;
  answers: QuizAnswers;
  isComplete: boolean;
  canGoNext: boolean;
  canGoBack: boolean;
  answer: (questionId: string, value: string | string[] | number) => void;
  goNext: () => void;
  goBack: () => void;
}

function sliderDefaults(questions: QuizQuestion[]): QuizAnswers {
  const answers: QuizAnswers = {};
  for (const q of questions) {
    if (q.type === "slider" && q.id === "budget") answers.budget = q.default;
  }
  return answers;
}

export function useQuizFlow(questions: QuizQuestion[]): UseQuizFlowResult {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(() => sliderDefaults(questions));

  const isComplete = currentIndex >= questions.length;
  const currentQuestion = questions[Math.min(currentIndex, questions.length - 1)];

  const canGoNext = useMemo(() => {
    if (isComplete) return false;
    const q = currentQuestion;
    if (q.optional) return true;
    if (q.type === "slider") return true;
    const value = (answers as Record<string, unknown>)[q.id];
    if (q.multi) return Array.isArray(value) && value.length > 0;
    return typeof value === "string" && value.length > 0;
  }, [answers, currentQuestion, isComplete]);

  function answer(questionId: string, value: string | string[] | number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function goNext() {
    setCurrentIndex((i) => Math.min(i + 1, questions.length));
  }

  function goBack() {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }

  return {
    currentIndex,
    currentQuestion,
    answers,
    isComplete,
    canGoNext,
    canGoBack: currentIndex > 0,
    answer,
    goNext,
    goBack,
  };
}
