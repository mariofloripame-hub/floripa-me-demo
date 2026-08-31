import { describe, it, expect } from "vitest";
import { QUESTIONS } from "./questions";

describe("QUESTIONS", () => {
  it("has exactly 8 questions in the documented order", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual([
      "timing", "region", "days", "group", "style", "transport", "budget", "special",
    ]);
  });

  it("marks region and special as optional, and the rest as required", () => {
    const optional = QUESTIONS.filter((q) => q.optional).map((q) => q.id);
    expect(optional).toEqual(["region", "special"]);
  });

  it("marks style as the only multi-select question", () => {
    const multi = QUESTIONS.filter((q) => q.type !== "slider" && q.multi).map((q) => q.id);
    expect(multi).toEqual(["style"]);
  });

  it("gives the budget slider a default within its min/max range", () => {
    const budget = QUESTIONS.find((q) => q.id === "budget");
    if (budget?.type !== "slider") throw new Error("budget must be a slider question");
    expect(budget.default).toBeGreaterThanOrEqual(budget.min);
    expect(budget.default).toBeLessThanOrEqual(budget.max);
  });
});
