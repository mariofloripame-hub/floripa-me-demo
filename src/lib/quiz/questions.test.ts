import { describe, it, expect } from "vitest";
import { QUESTIONS } from "./questions";

describe("QUESTIONS", () => {
  it("has exactly 9 questions in the documented order", () => {
    expect(QUESTIONS.map((q) => q.id)).toEqual([
      "purpose", "when", "region", "days", "group", "style", "transport", "budget", "special",
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

  it("has no slider question anymore", () => {
    expect(QUESTIONS.some((q) => q.type === "slider")).toBe(false);
  });

  it("offers exactly 3 budget options: economico, medio, alto", () => {
    const budget = QUESTIONS.find((q) => q.id === "budget");
    if (budget?.type === "slider") throw new Error("budget must not be a slider question");
    expect(budget?.options.map((o) => o.value)).toEqual(["economico", "medio", "alto"]);
  });

  it("offers 5 purpose options including familia_amigos", () => {
    const purpose = QUESTIONS.find((q) => q.id === "purpose");
    if (purpose?.type === "slider") throw new Error("purpose must not be a slider question");
    expect(purpose?.options.map((o) => o.value)).toEqual([
      "passeio", "negocios", "estudo_congresso", "atividade_fisica", "familia_amigos",
    ]);
  });

  it("offers 5 when options for the travel window", () => {
    const when = QUESTIONS.find((q) => q.id === "when");
    if (when?.type === "slider") throw new Error("when must not be a slider question");
    expect(when?.options.map((o) => o.value)).toEqual([
      "chegou", "proximos_7_dias", "2_a_4_semanas", "mais_de_um_mes", "planejando",
    ]);
  });

  it("no longer offers 'negocios' as a style option (purpose covers that signal now)", () => {
    const style = QUESTIONS.find((q) => q.id === "style");
    if (style?.type === "slider") throw new Error("style must not be a slider question");
    expect(style?.options.map((o) => o.value)).not.toContain("negocios");
  });

  it("keeps days and transport exactly as before", () => {
    const days = QUESTIONS.find((q) => q.id === "days");
    if (days?.type === "slider") throw new Error("days must not be a slider question");
    expect(days?.options.map((o) => o.value)).toEqual(["1", "2", "3-4", "5+"]);

    const transport = QUESTIONS.find((q) => q.id === "transport");
    if (transport?.type === "slider") throw new Error("transport must not be a slider question");
    expect(transport?.options.map((o) => o.value)).toEqual(["carro", "app", "onibus", "pe"]);
  });
});
