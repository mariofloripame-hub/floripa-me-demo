import { describe, it, expect } from "vitest";
import { COUPONS, PLANS, regionOptions, categoryOptions } from "./coupons";

describe("clube coupon data", () => {
  it("has two plans, Local and Local+, with the right prices and limits", () => {
    expect(PLANS).toEqual([
      { id: "local", name: "Local", priceLabel: "R$19,90", couponsPerMonth: 3, description: "3 cupons por mês" },
      { id: "local+", name: "Local+", priceLabel: "R$34,90", couponsPerMonth: 6, description: "6 cupons por mês" },
    ]);
  });

  it("has coupons with unique ids", () => {
    const ids = COUPONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(COUPONS.length).toBeGreaterThan(0);
  });
});

describe("regionOptions", () => {
  it("returns one option per distinct region present in the given coupons, with a count each", () => {
    const coupons = [
      { id: "a", name: "A", neighborhood: "X", region: "Sul" as const, category: "Gastronomia" as const, offer: "o", icon: "🍽️" },
      { id: "b", name: "B", neighborhood: "Y", region: "Sul" as const, category: "Bares" as const, offer: "o", icon: "🍹" },
      { id: "c", name: "C", neighborhood: "Z", region: "Centro" as const, category: "Compras" as const, offer: "o", icon: "🛍️" },
    ];
    const result = regionOptions(coupons);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.value === "Sul")?.count).toBe(2);
    expect(result.find((r) => r.value === "Centro")?.count).toBe(1);
  });
});

describe("categoryOptions", () => {
  it("returns one option per distinct category present in the given coupons, with a count each", () => {
    const coupons = [
      { id: "a", name: "A", neighborhood: "X", region: "Sul" as const, category: "Gastronomia" as const, offer: "o", icon: "🍽️" },
      { id: "b", name: "B", neighborhood: "Y", region: "Sul" as const, category: "Gastronomia" as const, offer: "o", icon: "🍽️" },
      { id: "c", name: "C", neighborhood: "Z", region: "Centro" as const, category: "Compras" as const, offer: "o", icon: "🛍️" },
    ];
    const result = categoryOptions(coupons);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.value === "Gastronomia")?.count).toBe(2);
    expect(result.find((r) => r.value === "Compras")?.count).toBe(1);
  });
});
