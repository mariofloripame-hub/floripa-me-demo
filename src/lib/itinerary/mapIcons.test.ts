import { describe, it, expect } from "vitest";
import { getCategoryStyle, categoryIconOptions, CATEGORY_STYLES } from "./mapIcons";

describe("getCategoryStyle", () => {
  it("returns the mapped style for a known category", () => {
    expect(getCategoryStyle("Praia").color).toBe(CATEGORY_STYLES.Praia.color);
  });

  it("falls back to a default style for an unknown category", () => {
    const style = getCategoryStyle("Categoria Inexistente");
    expect(style.color).toBe("#123542");
  });
});

describe("categoryIconOptions", () => {
  it("builds a bigger, opaque icon for a confirmed itinerary stop", () => {
    const opts = categoryIconOptions("Praia", "stop");
    expect(opts.iconSize).toEqual([34, 34]);
    expect(opts.html).toContain("#00A8E0");
    expect(opts.html).toContain("opacity:1");
  });

  it("adds a gold border for a partner stop", () => {
    const opts = categoryIconOptions("Praia", "partner");
    expect(opts.html).toContain("#F2B705");
  });

  it("builds a smaller, translucent icon for a suggestion", () => {
    const opts = categoryIconOptions("Gastronomia", "suggestion");
    expect(opts.iconSize).toEqual([26, 26]);
    expect(opts.html).toContain("opacity:0.85");
    expect(opts.html).toContain("#FF7A59");
  });
});
