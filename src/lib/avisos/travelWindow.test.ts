import { describe, it, expect } from "vitest";
import { resolveTravelMonth } from "./travelWindow";

describe("resolveTravelMonth", () => {
  it("resolves 'chegou' and 'proximos_7_dias' to the current month", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(resolveTravelMonth("chegou", now)).toBe(3);
    expect(resolveTravelMonth("proximos_7_dias", now)).toBe(3);
  });

  it("resolves '2_a_4_semanas' to the month 21 days from now", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(resolveTravelMonth("2_a_4_semanas", now)).toBe(4);
  });

  it("wraps '2_a_4_semanas' across a year boundary", () => {
    const now = new Date("2026-12-20T12:00:00Z");
    expect(resolveTravelMonth("2_a_4_semanas", now)).toBe(1);
  });

  it("returns null for 'mais_de_um_mes' and 'planejando' — the exact month is too uncertain", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(resolveTravelMonth("mais_de_um_mes", now)).toBeNull();
    expect(resolveTravelMonth("planejando", now)).toBeNull();
  });

  it("returns null when when is undefined or an unrecognized value", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(resolveTravelMonth(undefined, now)).toBeNull();
    // @ts-expect-error — deliberately passing bad/legacy data
    expect(resolveTravelMonth("garbage", now)).toBeNull();
  });

  it("defaults 'now' to the real current date when not provided", () => {
    const result = resolveTravelMonth("chegou");
    expect(result).toBe(new Date().getMonth() + 1);
  });
});
