import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuizFlow } from "./useQuizFlow";
import type { QuizQuestion } from "./types";

const QUESTIONS: QuizQuestion[] = [
  { id: "timing", text: "t1", sub: "s1", type: "rows", options: [{ emoji: "a", label: "A", desc: "d", value: "a" }] },
  { id: "region", text: "t2", sub: "s2", type: "rows", optional: true, options: [{ emoji: "a", label: "A", desc: "d", value: "a" }] },
  { id: "style", text: "t3", sub: "s3", type: "grid2", multi: true, options: [{ emoji: "a", label: "A", desc: "d", value: "a" }, { emoji: "b", label: "B", desc: "d", value: "b" }] },
  { id: "budget", text: "t4", sub: "s4", type: "slider", min: 50, max: 600, default: 150, unit: "R$" },
];

describe("useQuizFlow", () => {
  it("starts at the first question with canGoNext false for a required unanswered question", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentQuestion.id).toBe("timing");
    expect(result.current.canGoNext).toBe(false);
  });

  it("allows advancing an optional question without answering it", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    expect(result.current.currentQuestion.id).toBe("region");
    expect(result.current.canGoNext).toBe(true);
  });

  it("requires at least one selection for a multi-select question", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    act(() => result.current.goNext()); // skip optional region
    expect(result.current.currentQuestion.id).toBe("style");
    expect(result.current.canGoNext).toBe(false);
    act(() => result.current.answer("style", ["a"]));
    expect(result.current.canGoNext).toBe(true);
  });

  it("treats a slider question as always answerable via its default", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    act(() => result.current.goNext());
    act(() => result.current.answer("style", ["a"]));
    act(() => result.current.goNext());
    expect(result.current.currentQuestion.id).toBe("budget");
    expect(result.current.canGoNext).toBe(true);
  });

  it("sets isComplete true after advancing past the last question", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    act(() => result.current.goNext());
    act(() => result.current.answer("style", ["a"]));
    act(() => result.current.goNext());
    act(() => result.current.goNext());
    expect(result.current.isComplete).toBe(true);
    expect(result.current.answers).toMatchObject({ timing: "a", style: ["a"], budget: 150 });
  });

  it("goBack moves to the previous question and canGoBack reflects position", () => {
    const { result } = renderHook(() => useQuizFlow(QUESTIONS));
    expect(result.current.canGoBack).toBe(false);
    act(() => result.current.answer("timing", "a"));
    act(() => result.current.goNext());
    expect(result.current.canGoBack).toBe(true);
    act(() => result.current.goBack());
    expect(result.current.currentQuestion.id).toBe("timing");
  });
});
