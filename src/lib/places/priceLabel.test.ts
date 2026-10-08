import { describe, it, expect } from "vitest";
import { priceBadge, priceLabel } from "./priceLabel";

describe("priceLabel", () => {
  it.each([
    ["Gratuito", "Grátis"],
    ["R$", "Econômico"],
    ["R$$", "Médio"],
    ["R$$$", "Alto"],
  ])("%s → %s", (range, label) => expect(priceLabel(range)).toBe(label));

  it("keeps an unknown legacy value as is", () => expect(priceLabel("R$$$$")).toBe("R$$$$"));
});

describe("priceBadge", () => {
  it.each([
    ["Gratuito", "🎟️ Grátis"],
    ["R$", "💰 Econômico"],
    ["R$$", "💵 Médio"],
    ["R$$$", "💎 Alto"],
  ])("%s → %s", (range, badge) => expect(priceBadge(range)).toBe(badge));
});
