"use client";

import type { QuizChoiceQuestion, QuizQuestion } from "@/lib/quiz/types";

interface QuestionCardProps {
  question: QuizQuestion;
  value: string | string[] | number | undefined;
  onAnswer: (value: string | string[] | number) => void;
}

export function QuestionCard({ question, value, onAnswer }: QuestionCardProps) {
  return (
    <div>
      <h2 className="font-display text-2xl font-extrabold">{question.text}</h2>
      <p className="mt-1 text-sm text-ink-dim">{question.sub}</p>

      {question.type === "slider" ? (
        <div className="mt-8">
          <div className="mb-3 font-display text-3xl font-extrabold text-turquoise">
            {question.unit} {value ?? question.default}
          </div>
          <input
            role="slider"
            type="range"
            min={question.min}
            max={question.max}
            value={typeof value === "number" ? value : question.default}
            onChange={(e) => onAnswer(Number(e.target.value))}
            className="w-full accent-turquoise"
          />
        </div>
      ) : (
        <QuestionOptions question={question} value={value} onAnswer={onAnswer} />
      )}
    </div>
  );
}

function QuestionOptions({
  question,
  value,
  onAnswer,
}: {
  question: QuizChoiceQuestion;
  value: string | string[] | number | undefined;
  onAnswer: (value: string | string[] | number) => void;
}) {
  const isMulti = question.multi === true;

  const buttons = question.options.map((opt) => {
    const selected = isMulti ? Array.isArray(value) && value.includes(opt.value) : value === opt.value;

    function handleClick() {
      if (isMulti) {
        const current = Array.isArray(value) ? value : [];
        const next = current.includes(opt.value) ? current.filter((v) => v !== opt.value) : [...current, opt.value];
        onAnswer(next);
      } else {
        onAnswer(opt.value);
      }
    }

    return (
      <button
        key={opt.value}
        type="button"
        role="button"
        aria-pressed={selected}
        onClick={handleClick}
        className={`flex items-center gap-2.5 border px-4 py-2.5 text-left transition-colors ${
          question.type === "grid2" ? "rounded-card" : "rounded-pill"
        } ${selected ? "border-turquoise bg-turquoise/10" : "border-white/10 bg-white/5"}`}
      >
        <span className="text-base">{opt.emoji}</span>
        <span className="flex flex-col">
          <span className="font-display text-sm font-bold leading-tight">{opt.label}</span>
          <span className="text-xs leading-tight text-ink-dim">{opt.desc}</span>
        </span>
      </button>
    );
  });

  if (question.type === "grid2") {
    return <div className="mt-6 mb-6 grid grid-cols-2 gap-2">{buttons}</div>;
  }

  return (
    <div className="mt-6 mb-6 flex justify-center">
      <div className="flex w-72 flex-col gap-2">{buttons}</div>
    </div>
  );
}
