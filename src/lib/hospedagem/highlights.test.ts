import { describe, it, expect } from "vitest";
import { HIGHLIGHT_OPTIONS, highlightChoices, orderHighlights } from "./highlights";

describe("HIGHLIGHT_OPTIONS", () => {
  it("offers the 10 curated highlights", () => {
    expect(HIGHLIGHT_OPTIONS).toHaveLength(10);
    expect(HIGHLIGHT_OPTIONS[0]).toBe("🌊 Vista para o mar");
  });
});

describe("orderHighlights", () => {
  it("follows the order of the option list, whatever order they were ticked", () => {
    expect(orderHighlights(["🐾 Pet friendly", "🌊 Vista para o mar"])).toEqual(["🌊 Vista para o mar", "🐾 Pet friendly"]);
  });

  it("keeps a legacy highlight that is not in the list, after the listed ones", () => {
    expect(orderHighlights(["Rooftop", "🏊 Piscina"])).toEqual(["🏊 Piscina", "Rooftop"]);
  });

  it("drops blanks and duplicates", () => {
    expect(orderHighlights(["🏊 Piscina", " ", "🏊 Piscina"])).toEqual(["🏊 Piscina"]);
  });
});

describe("highlightChoices", () => {
  it("lists the curated options", () => {
    expect(highlightChoices([])).toEqual(HIGHLIGHT_OPTIONS);
  });

  it("adds saved legacy highlights at the end so they are not lost", () => {
    expect(highlightChoices(["Rooftop", "🏊 Piscina"])).toEqual([...HIGHLIGHT_OPTIONS, "Rooftop"]);
  });
});
