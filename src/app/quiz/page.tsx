"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS } from "@/lib/quiz/questions";
import { useQuizFlow } from "@/lib/quiz/useQuizFlow";
import { submitQuizAnswers } from "@/lib/quiz/submit";
import { ProgressBar } from "@/components/quiz/ProgressBar";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import type { QuizAnswers } from "@/lib/quiz/types";

export default function QuizPage() {
  const router = useRouter();
  const flow = useQuizFlow(QUESTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLastQuestion = flow.currentIndex === QUESTIONS.length - 1;

  async function handleContinue() {
    if (!flow.canGoNext || submitting) return;
    if (!isLastQuestion) {
      flow.goNext();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { slug } = await submitQuizAnswers(flow.answers);
      window.localStorage.setItem("floripa_last_itinerary_slug", slug);
      router.push(`/roteiro/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  const currentValue = (flow.answers as QuizAnswers & Record<string, unknown>)[flow.currentQuestion.id] as
    | string
    | string[]
    | number
    | undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <ProgressBar current={flow.currentIndex + 1} total={QUESTIONS.length} />
      <div className="mt-8 flex-1">
        <QuestionCard
          question={flow.currentQuestion}
          value={currentValue}
          onAnswer={(v) => flow.answer(flow.currentQuestion.id, v)}
        />
      </div>
      {error && <p className="mb-3 text-sm text-alert">{error}</p>}
      <div className="flex gap-3">
        {flow.canGoBack && (
          <button type="button" onClick={flow.goBack} className="rounded-pill px-4 py-3 text-sm text-ink-dim">
            Voltar
          </button>
        )}
        <button
          type="button"
          disabled={!flow.canGoNext || submitting}
          onClick={handleContinue}
          className="flex-1 rounded-pill bg-gradient-to-r from-turquoise to-blue py-3 font-display font-extrabold text-graphite disabled:opacity-40"
        >
          {submitting ? "Montando seu roteiro..." : isLastQuestion ? "Ver meu roteiro →" : "Continuar →"}
        </button>
      </div>
    </main>
  );
}
