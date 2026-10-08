import { describe, it, expect } from "vitest";
import { cardHighlights, HIGHLIGHT_OPTIONS, orderHighlights } from "./highlights";

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

  it("drops highlights that are not in the list (old free text)", () => {
    expect(orderHighlights(["Vista mar", "🏊 Piscina"])).toEqual(["🏊 Piscina"]);
  });

  it("drops duplicates", () => {
    expect(orderHighlights(["🏊 Piscina", "🏊 Piscina"])).toEqual(["🏊 Piscina"]);
  });
});

describe("cardHighlights", () => {
  const all = [...HIGHLIGHT_OPTIONS];

  it("shows at most 3", () => {
    expect(cardHighlights(all, undefined)).toHaveLength(3);
  });

  it("puts sea view and breakfast first", () => {
    expect(cardHighlights(["🏊 Piscina", "☕ Café da manhã incluso", "🐾 Pet friendly", "🌊 Vista para o mar"], undefined)).toEqual([
      "🌊 Vista para o mar",
      "☕ Café da manhã incluso",
      "🏊 Piscina",
    ]);
  });

  it("brings the tourist's profile highlight right after them", () => {
    const highlights = ["🏊 Piscina", "☕ Café da manhã incluso", "👨‍👩‍👧 Ideal para famílias", "💑 Ideal para casais"];
    expect(cardHighlights(highlights, "familia")).toEqual(["☕ Café da manhã incluso", "👨‍👩‍👧 Ideal para famílias", "🏊 Piscina"]);
    expect(cardHighlights(highlights, "casal")).toEqual(["☕ Café da manhã incluso", "💑 Ideal para casais", "🏊 Piscina"]);
  });

  it("does not push another profile's highlight ahead for solo travellers", () => {
    expect(cardHighlights(["💑 Ideal para casais", "🏊 Piscina"], "solo")).toEqual(["🏊 Piscina", "💑 Ideal para casais"]);
  });

  it("ignores old free-text highlights", () => {
    expect(cardHighlights(["Vista mar"], "casal")).toEqual([]);
  });
});
