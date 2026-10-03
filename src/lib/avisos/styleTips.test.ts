import { describe, it, expect } from "vitest";
import { styleTips } from "./styleTips";

describe("styleTips", () => {
  it("returns a work-focused tip when negocios is among the chosen styles", () => {
    expect(styleTips(["negocios"]).map((t) => t.label)).toEqual(["Trabalho"]);
  });

  it("returns a trilhas/treino tip when praia is among the chosen styles", () => {
    expect(styleTips(["praia"]).map((t) => t.label)).toEqual(["Atividade física"]);
  });

  it("returns one tip per matching style, in the order chosen", () => {
    expect(styleTips(["praia", "gastronomia", "negocios"]).map((t) => t.label)).toEqual([
      "Atividade física",
      "Trabalho",
    ]);
  });

  it("returns nothing for other styles and unanswered", () => {
    expect(styleTips(["gastronomia", "noite"])).toEqual([]);
    expect(styleTips([])).toEqual([]);
    expect(styleTips(undefined)).toEqual([]);
  });
});
