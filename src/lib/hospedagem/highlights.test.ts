import { describe, it, expect } from "vitest";
import { highlightsError, parseHighlights } from "./highlights";

describe("parseHighlights", () => {
  it("splits on commas and trims", () => {
    expect(parseHighlights(" 🌊 Vista para o mar ,☕ Café da manhã ")).toEqual(["🌊 Vista para o mar", "☕ Café da manhã"]);
  });

  it("drops empty items", () => {
    expect(parseHighlights("Piscina,, ,")).toEqual(["Piscina"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseHighlights("")).toEqual([]);
  });
});

describe("highlightsError", () => {
  it("accepts up to 3 short items", () => {
    expect(highlightsError("Piscina, Spa, Pet friendly")).toBeNull();
  });

  it("rejects more than 3 items", () => {
    expect(highlightsError("A, B, C, D")).toBe("Use no máximo 3 destaques");
  });

  it("rejects an item longer than 30 characters", () => {
    expect(highlightsError("Uma vista absolutamente incrível para o mar")).toBe("Cada destaque pode ter até 30 caracteres");
  });
});
