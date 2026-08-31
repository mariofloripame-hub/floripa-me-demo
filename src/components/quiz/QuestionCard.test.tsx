import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QuestionCard } from "./QuestionCard";
import type { QuizQuestion } from "@/lib/quiz/types";

const rowsQuestion: QuizQuestion = {
  id: "timing", text: "Como você chega?", sub: "sub", type: "rows",
  options: [{ emoji: "✈️", label: "Avião", desc: "d", value: "aviao" }, { emoji: "🚌", label: "Ônibus", desc: "d", value: "onibus" }],
};

const multiQuestion: QuizQuestion = {
  id: "style", text: "Estilo", sub: "sub", type: "grid2", multi: true,
  options: [{ emoji: "🏄", label: "Praia", desc: "d", value: "praia" }, { emoji: "🍽️", label: "Gastro", desc: "d", value: "gastronomia" }],
};

const sliderQuestion: QuizQuestion = {
  id: "budget", text: "Orçamento", sub: "sub", type: "slider", min: 50, max: 600, default: 150, unit: "R$",
};

describe("QuestionCard", () => {
  it("renders rows options and calls onAnswer with the selected value", () => {
    const onAnswer = vi.fn();
    render(<QuestionCard question={rowsQuestion} value={undefined} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: /avião/i }));
    expect(onAnswer).toHaveBeenCalledWith("aviao");
  });

  it("marks the selected single-choice option as pressed", () => {
    render(<QuestionCard question={rowsQuestion} value="onibus" onAnswer={vi.fn()} />);
    expect(screen.getByRole("button", { name: /ônibus/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /avião/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles a value on and off for a multi-select question", () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<QuestionCard question={multiQuestion} value={[]} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: /praia/i }));
    expect(onAnswer).toHaveBeenCalledWith(["praia"]);

    rerender(<QuestionCard question={multiQuestion} value={["praia"]} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: /praia/i }));
    expect(onAnswer).toHaveBeenCalledWith([]);
  });

  it("calls onAnswer with a number when the slider changes", () => {
    const onAnswer = vi.fn();
    render(<QuestionCard question={sliderQuestion} value={150} onAnswer={onAnswer} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "300" } });
    expect(onAnswer).toHaveBeenCalledWith(300);
  });
});
