"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QUESTIONS } from "@/lib/quiz/questions";
import { useQuizFlow } from "@/lib/quiz/useQuizFlow";
import { submitQuizAnswers } from "@/lib/quiz/submit";
import { ProgressBar } from "@/components/quiz/ProgressBar";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { GeneratingOverlay } from "@/components/quiz/GeneratingOverlay";
import type { QuizAnswers } from "@/lib/quiz/types";

const AUTO_ADVANCE_DELAY = 350;

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M19 12H5M11 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function QuizPage() {
  const router = useRouter();
  const flow = useQuizFlow(QUESTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const autoAdvanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);
    };
  }, []);

  const isLastQuestion = flow.currentIndex === QUESTIONS.length - 1;

  async function finish(answers: QuizAnswers) {
    setSubmitting(true);
    setError(null);
    try {
      const { slug } = await submitQuizAnswers(answers);
      window.localStorage.setItem("floripa_last_itinerary_slug", slug);
      router.push(`/roteiro/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  async function handleContinue() {
    if (!flow.canGoNext || submitting) return;
    if (!isLastQuestion) {
      setDirection("forward");
      flow.goNext();
      return;
    }
    await finish(flow.answers);
  }

  function handleAnswer(value: string | string[] | number) {
    const question = flow.currentQuestion;
    const questionIndex = flow.currentIndex;
    flow.answer(question.id, value);

    if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);

    // Only single-answer questions (rows/grid2 without multi) auto-advance —
    // multi-select needs an explicit Continuar, and the slider has no discrete "done" click.
    if (question.type === "slider" || question.multi) return;

    const mergedAnswers = { ...flow.answers, [question.id]: value } as QuizAnswers;
    autoAdvanceTimeout.current = setTimeout(() => {
      autoAdvanceTimeout.current = null;
      if (questionIndex === QUESTIONS.length - 1) {
        finish(mergedAnswers);
      } else {
        setDirection("forward");
        flow.goNext();
      }
    }, AUTO_ADVANCE_DELAY);
  }

  function handleBack() {
    if (autoAdvanceTimeout.current) clearTimeout(autoAdvanceTimeout.current);
    if (flow.canGoBack) {
      setDirection("back");
      flow.goBack();
    } else {
      router.push("/");
    }
  }

  const currentValue = (flow.answers as QuizAnswers & Record<string, unknown>)[flow.currentQuestion.id] as
    | string
    | string[]
    | number
    | undefined;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-graphite text-ink">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Image
          src="/images/bridge-sunset.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-graphite/85" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Voltar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-ink transition-colors hover:bg-white/20"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
          <span className="font-display text-sm font-extrabold">
            Floripa<span className="text-coral">.</span>
            <span className="text-turquoise">me</span>
          </span>
        </div>

        {submitting ? (
          <GeneratingOverlay />
        ) : (
          <>
            <div className="mt-6">
              <ProgressBar current={flow.currentIndex + 1} total={QUESTIONS.length} />
            </div>

            <div
              key={flow.currentIndex}
              className={`mt-8 flex-1 ${direction === "forward" ? "quiz-slide-forward" : "quiz-slide-back"}`}
            >
              <QuestionCard question={flow.currentQuestion} value={currentValue} onAnswer={handleAnswer} />
            </div>

            {error && <p className="mb-3 text-sm text-alert">{error}</p>}

            <button
              type="button"
              disabled={!flow.canGoNext}
              onClick={handleContinue}
              className="w-full rounded-pill bg-gradient-to-r from-turquoise to-blue py-3 text-sm font-display font-extrabold text-graphite disabled:opacity-40"
            >
              {isLastQuestion ? "Ver meu roteiro →" : "Continuar →"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
