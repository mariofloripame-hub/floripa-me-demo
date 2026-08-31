"use client";

import type { QuizQuestion } from "@/lib/quiz/types";

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
        <div className={question.type === "grid2" ? "mt-6 grid grid-cols-2 gap-2" : "mt-6 flex flex-col gap-2"}>
          {question.options.map((opt) => {
            const isMulti = question.multi === true;
            const selected = isMulti
              ? Array.isArray(value) && value.includes(opt.value)
              : value === opt.value;

            function handleClick() {
              if (isMulti) {
                const current = Array.isArray(value) ? value : [];
                const next = current.includes(opt.value)
                  ? current.filter((v) => v !== opt.value)
                  : [...current, opt.value];
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
                className={`rounded-card border p-3 text-left transition-colors ${
                  selected ? "border-turquoise bg-turquoise/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="text-xl">{opt.emoji}</div>
                <div className="font-display text-sm font-bold">{opt.label}</div>
                <div className="text-xs text-ink-dim">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
